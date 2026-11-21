import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = name => readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/modules/notifications/notification-outbox.ts', import.meta.url), 'utf8');
const claim = source.match(/CLAIM_NOTIFICATION_SQL = `([\s\S]+?)`;/)[1];

test('outbox migration, rollback, claim fencing and inbox replay preserve data', async () => {
  const db = new PGlite();
  try {
    await db.exec(sql('00000000000000_baseline'));
    await db.exec(sql('20261121120000_notification_outbox'));
    await db.exec(`INSERT INTO users(id,username,"githubId","updatedAt") VALUES ('u','demo','g',now())`);
    const insert = id => db.query(`INSERT INTO notification_outbox(id,"eventKey","userId",type,title,message)
      VALUES ($1,$1,'u','SYSTEM','Title','Message')`, [id]);
    await assert.rejects(db.transaction(async tx => {
      await tx.exec(`INSERT INTO notification_outbox(id,"eventKey","userId",type,title,message)
        VALUES ('rollback','rollback','u','SYSTEM','Title','Message')`);
      throw new Error('business mutation rolled back');
    }), /rolled back/);
    assert.equal((await db.query('SELECT * FROM notification_outbox')).rows.length, 0);
    await insert('event');
    await assert.rejects(insert('event'), /duplicate/);
    const now = new Date();
    const expiry = new Date(now.getTime() + 60_000);
    const first = await db.query(claim, [now, expiry, 'worker-a', 25, 5]);
    assert.equal(first.rows.length, 1);
    assert.equal((await db.query(claim, [now, expiry, 'worker-b', 25, 5])).rows.length, 0);
    const later = new Date(expiry.getTime() + 1);
    assert.equal((await db.query(claim, [later, new Date(later.getTime() + 60_000), 'worker-b', 25, 5])).rows[0].attempts, 2);
    assert.equal((await db.query(`UPDATE notification_outbox SET status='DELIVERED'
      WHERE id='event' AND "leaseToken"='worker-a' RETURNING id`)).rows.length, 0);
    await db.transaction(async tx => {
      await tx.exec(`INSERT INTO notifications(id,"userId",type,title,message,"isRead")
        VALUES ('event','u','SYSTEM','Title','Message',true);
        UPDATE notification_outbox SET status='DELIVERED' WHERE id='event';`);
    });
    await db.exec(`INSERT INTO notifications(id,"userId",type,title,message)
      VALUES ('event','u','SYSTEM','Replay','Replay') ON CONFLICT (id) DO NOTHING`);
    assert.deepEqual((await db.query('SELECT title,"isRead" FROM notifications')).rows, [{ title: 'Title', isRead: true }]);
    await db.exec(`DELETE FROM users WHERE id='u'`);
    assert.equal((await db.query('SELECT * FROM notification_outbox')).rows.length, 0);
  } finally { await db.close(); }
});
