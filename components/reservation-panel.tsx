'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2, Users, X } from 'lucide-react';
import { submitReservation, type ReservationState } from '@/app/actions/reservation';
import { todayJakarta } from '@/lib/reservation';
import { HONEYPOT_FIELD, TOKEN_FIELD } from '@/lib/antispam.shared';
import { formatPrice, type RoomOption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type PanelService = {
  id: string;
  name: string;
  booking_method: 'self_service' | 'exely';
};

type PanelItem = { id: string; name: string; price: number | string };

type Stay = { checkIn: string; checkOut: string; adults: number };

const EMPTY: ReservationState = { errors: {} };

export function ReservationPanel({ service, items }: { service: PanelService; items: PanelItem[] }) {
  const isExely = service.booking_method === 'exely';
  const [open, setOpen] = useState(false);
  const [stay, setStay] = useState<Stay | null>(null);
  const [room, setRoom] = useState<RoomOption | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Token anti-bot diambil saat dialog dibuka — halaman ini di-prerender, jadi
  // token yang ditanam ke HTML statis sudah basi sebelum sempat dipakai.
  useEffect(() => {
    if (!open || token) return;
    let alive = true;
    fetch('/api/reservasi/token')
      .then((r) => r.json())
      .then((d) => {
        if (alive) setToken(d.token as string);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, token]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setStay(null);
      setRoom(null);
    }
  }

  const showForm = !isExely || room !== null;

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="btn-pill w-full sm:w-auto"
      >
        {isExely ? 'Cek ketersediaan kamar' : 'Ajukan reservasi'}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Tombol tutup bawaan ikut ter-scroll karena isinya panjang, jadi
            dimatikan dan dipindah ke header yang sticky. */}
        <DialogContent
          showCloseButton={false}
          className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-lg"
        >
          <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4 pr-14 text-left sm:px-6 sm:pr-14">
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Tutup"
                className="absolute right-4 top-4 size-9"
              >
                <X />
              </Button>
            </DialogClose>
            <DialogTitle className="font-heading text-2xl">{service.name}</DialogTitle>
            <DialogDescription>
              {showForm
                ? 'Isi data Anda. Tim kami menghubungi untuk konfirmasi — belum ada pembayaran.'
                : 'Pilih tanggal menginap dulu, lalu pilih kamarnya.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 py-5 sm:px-6">
            {isExely && !room && <RoomSearch stay={stay} onStay={setStay} onPick={setRoom} />}
            {showForm && (
              <ReservationForm
                service={service}
                items={isExely ? [] : items}
                stay={isExely ? stay : null}
                room={room}
                token={token}
                onBack={isExely ? () => setRoom(null) : undefined}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------------------------------------------------------- Exely --- */

function RoomSearch({
  stay,
  onStay,
  onPick,
}: {
  stay: Stay | null;
  onStay: (s: Stay) => void;
  onPick: (r: RoomOption) => void;
}) {
  const today = todayJakarta();
  const [rooms, setRooms] = useState<RoomOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(formData: FormData) {
    const next: Stay = {
      checkIn: String(formData.get('check_in') ?? ''),
      checkOut: String(formData.get('check_out') ?? ''),
      adults: Number(formData.get('adults') ?? 1),
    };
    if (next.checkOut <= next.checkIn) {
      setError('Tanggal check-out harus setelah tanggal check-in.');
      return;
    }

    setLoading(true);
    setError(null);
    setRooms(null);
    onStay(next);

    try {
      const res = await fetch(
        `/api/exely/rooms?check_in=${next.checkIn}&check_out=${next.checkOut}&adults=${next.adults}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengambil ketersediaan kamar.');
        return;
      }
      setRooms(data.rooms as RoomOption[]);
    } catch {
      // Jaringan putus / server tidak menjawab.
      setError('Koneksi bermasalah. Periksa internet Anda lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  const nights =
    stay && stay.checkOut > stay.checkIn
      ? Math.round((Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86_400_000)
      : 0;

  return (
    <>
      <form action={search} className="grid gap-4 sm:grid-cols-2">
        <Field id="check_in" label="Check-in" icon={<CalendarDays className="size-3.5" />}>
          <Input
            id="check_in"
            type="date"
            name="check_in"
            required
            min={today}
            defaultValue={stay?.checkIn}
            className="h-11"
          />
        </Field>
        <Field id="check_out" label="Check-out" icon={<CalendarDays className="size-3.5" />}>
          <Input
            id="check_out"
            type="date"
            name="check_out"
            required
            min={today}
            defaultValue={stay?.checkOut}
            className="h-11"
          />
        </Field>
        <Field id="adults" label="Jumlah tamu" icon={<Users className="size-3.5" />}>
          <Input
            id="adults"
            type="number"
            name="adults"
            required
            min={1}
            max={50}
            defaultValue={stay?.adults ?? 2}
            className="h-11"
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-full">
            {loading && <Loader2 className="animate-spin" />}
            {loading ? 'Mencari kamar…' : 'Cek ketersediaan'}
          </Button>
        </div>
      </form>

      {error && <Alert>{error}</Alert>}

      {loading && (
        <ul className="mt-6 space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-1/3" />
              <Skeleton className="mt-4 h-10 w-full" />
            </li>
          ))}
        </ul>
      )}

      {!loading && rooms && rooms.length === 0 && (
        <Alert tone="info">
          Tidak ada kamar tersedia untuk tanggal tersebut. Coba geser tanggalnya, atau hubungi kami
          langsung — kadang masih ada sisa kamar yang belum tampil di sini.
        </Alert>
      )}

      {!loading && rooms && rooms.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            {rooms.length} pilihan tersedia
            {nights > 0 && <> untuk {nights} malam</>}
          </p>
          <ul className="mt-3 space-y-3">
            {rooms.map((r) => (
              <li
                key={`${r.roomTypeId}-${r.mealPlan ?? ''}`}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="font-medium text-foreground">{r.name}</p>
                {r.mealPlan && <p className="mt-0.5 text-sm text-muted-foreground">{r.mealPlan}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-primary">{formatPrice(r.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      total{nights > 0 && <> untuk {nights} malam</>}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => onPick(r)}
                    className="h-10 rounded-full px-6"
                    aria-label={`Pilih ${r.name}`}
                  >
                    Pilih
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- Form --- */

function ReservationForm({
  service,
  items,
  stay,
  room,
  token,
  onBack,
}: {
  service: PanelService;
  items: PanelItem[];
  stay: Stay | null;
  room: RoomOption | null;
  token: string | null;
  onBack?: () => void;
}) {
  const [state, formAction, pending] = useActionState(submitReservation, EMPTY);
  const today = todayJakarta();
  const errorRef = useRef<HTMLDivElement>(null);
  const prev = state.values;

  // React mereset <form> setelah Server Action selesai, jadi isian tamu hilang
  // setiap kali submit gagal. Solusinya: pasang ulang form dengan defaultValue
  // yang dikembalikan server. Menyesuaikan state saat render seperti ini adalah
  // pola resmi React untuk "turunan dari props", bukan efek samping.
  const [seenState, setSeenState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (seenState !== state) {
    setSeenState(state);
    setFormKey((k) => k + 1);
  }

  useEffect(() => {
    if (state.errors.form) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state]);

  return (
    <form key={formKey} action={formAction} className="grid gap-4">
      <input type="hidden" name="service_id" value={service.id} />
      <input type="hidden" name={TOKEN_FIELD} value={token ?? ''} />
      {/* Honeypot: tak terlihat, tak dibaca screen reader, tak bisa di-tab.
          Kalau terisi, pengirimnya bot. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor={HONEYPOT_FIELD}>Jangan diisi</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {room && stay ? (
        <>
          <input type="hidden" name="reservation_date" value={stay.checkIn} />
          <input type="hidden" name="checkout_date" value={stay.checkOut} />
          <input type="hidden" name="guests" value={stay.adults} />
          <input type="hidden" name="exely_room_type_id" value={room.roomTypeId} />
          <input type="hidden" name="exely_room_name" value={room.name} />
          <input type="hidden" name="exely_total_price" value={room.total} />

          <div className="rounded-xl bg-accent p-4">
            <p className="font-medium text-accent-foreground">{room.name}</p>
            <p className="mt-1 text-sm text-accent-foreground/80">
              {formatDate(stay.checkIn)} &rarr; {formatDate(stay.checkOut)} · {stay.adults} tamu
            </p>
            <p className="mt-1 font-semibold text-primary">{formatPrice(room.total)}</p>
            {onBack && (
              <Button
                type="button"
                variant="link"
                onClick={onBack}
                className="mt-1 h-auto p-0 text-accent-foreground"
              >
                Ganti pilihan kamar
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {items.length > 0 && (
            <Field
              id="service_item_id"
              label="Yang ingin dipesan"
              error={state.errors.service_item_id}
            >
              <Select name="service_item_id" required defaultValue={prev?.service_item_id}>
                <SelectTrigger id="service_item_id" className="h-11 w-full">
                  <SelectValue placeholder="Pilih salah satu" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} — {formatPrice(item.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="reservation_date"
              label="Tanggal kunjungan"
              error={state.errors.reservation_date}
            >
              <Input
                id="reservation_date"
                type="date"
                name="reservation_date"
                required
                min={today}
                defaultValue={prev?.reservation_date}
                className="h-11"
              />
            </Field>
            <Field id="guests" label="Jumlah tamu" error={state.errors.guests}>
              <Input
                id="guests"
                type="number"
                name="guests"
                required
                min={1}
                max={50}
                defaultValue={prev?.guests ?? 2}
                className="h-11"
              />
            </Field>
          </div>
        </>
      )}

      <Field id="customer_name" label="Nama lengkap" error={state.errors.customer_name}>
        <Input
          id="customer_name"
          name="customer_name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          defaultValue={prev?.customer_name}
          className="h-11"
        />
      </Field>

      <Field id="customer_email" label="Email" error={state.errors.customer_email}>
        <Input
          id="customer_email"
          type="email"
          name="customer_email"
          required
          maxLength={160}
          autoComplete="email"
          defaultValue={prev?.customer_email}
          className="h-11"
        />
      </Field>

      <Field
        id="customer_phone"
        label="Nomor telepon / WhatsApp"
        hint="Nomor ini yang kami hubungi untuk konfirmasi."
        error={state.errors.customer_phone}
      >
        <Input
          id="customer_phone"
          type="tel"
          inputMode="tel"
          name="customer_phone"
          required
          pattern="\+?[0-9][0-9 .\-]{7,19}"
          placeholder="0812 3456 7890"
          autoComplete="tel"
          defaultValue={prev?.customer_phone}
          className="h-11"
        />
      </Field>

      <Field
        id="notes"
        label="Catatan (opsional)"
        hint="Misalnya: rayakan ulang tahun, alergi makanan, minta kamar di lantai bawah."
        error={state.errors.notes}
      >
        <Textarea id="notes" name="notes" rows={3} maxLength={1000} defaultValue={prev?.notes} />
      </Field>

      <div ref={errorRef}>{state.errors.form && <Alert>{state.errors.form}</Alert>}</div>

      <Button
        type="submit"
        disabled={pending || !token}
        className="btn-pill mt-1 w-full"
      >
        {pending && <Loader2 className="animate-spin" />}
        {pending ? 'Mengirim…' : !token ? 'Menyiapkan formulir…' : 'Kirim permintaan reservasi'}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Ini permintaan reservasi, belum terkonfirmasi. Tidak ada pembayaran di tahap ini.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------- Potongan --- */

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
}

function Field({
  id,
  label,
  hint,
  error,
  icon,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Alert({
  children,
  tone = 'error',
}: {
  children: React.ReactNode;
  tone?: 'error' | 'info';
}) {
  return (
    <div
      role="alert"
      className={`mt-4 rounded-xl px-4 py-3 text-sm leading-relaxed ${
        tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
      }`}
    >
      {children}
    </div>
  );
}
