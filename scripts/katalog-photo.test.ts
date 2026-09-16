// node --conditions=react-server --test scripts/katalog-photo.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteFotoJikaMilikKita } from '../lib/katalog/photo.ts';

function fakeSupabaseStorage() {
  const removed: string[][] = [];
  const client = {
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  };
  return { client: client as never, removed };
}

test('deleteFotoJikaMilikKita: URL dari bucket katalog -> dihapus', async () => {
  const { client, removed } = fakeSupabaseStorage();
  await deleteFotoJikaMilikKita(
    client,
    'https://xxx.supabase.co/storage/v1/object/public/katalog/abc-123.webp'
  );
  assert.deepEqual(removed, [['abc-123.webp']]);
});

test('deleteFotoJikaMilikKita: URL domain lama (sanghyang.com) -> tidak disentuh', async () => {
  const { client, removed } = fakeSupabaseStorage();
  await deleteFotoJikaMilikKita(client, 'https://sanghyang.com/foto/rooms.jpg');
  assert.deepEqual(removed, []);
});

test('deleteFotoJikaMilikKita: null -> tidak dipanggil', async () => {
  const { client, removed } = fakeSupabaseStorage();
  await deleteFotoJikaMilikKita(client, null);
  assert.deepEqual(removed, []);
});
