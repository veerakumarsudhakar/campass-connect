const path = require('path');
const tools = 'C:/nvm4w/nodejs/node_modules/npm/nodejs/node_modules/firebase-tools';
const firestore = require(path.join(tools, 'lib/gcp/firestore.js'));
const { FirestoreDelete } = require(path.join(tools, 'lib/firestore/delete.js'));
const { Client } = require(path.join(tools, 'lib/apiv2.js'));
const { firestoreOrigin } = require(path.join(tools, 'lib/api.js'));

const project = 'campass-connect-d4f45';
const text = (doc, key) => doc.fields?.[key]?.stringValue || '';

async function allDocs(collectionId) {
  const result = await firestore.queryCollection(project, { from: [{ collectionId }], limit: 2000 });
  return result.documents;
}

async function removeDocs(docs) {
  for (let index = 0; index < docs.length; index += 400) {
    const count = await firestore.deleteDocuments(project, docs.slice(index, index + 400));
    console.log('deleted batch', count);
  }
}

(async () => {
  const collections = await firestore.listCollectionIds(project);
  console.log('collections:', collections.join(', ') || '(none)');
  const users = collections.includes('users') ? await allDocs('users') : [];
  const admins = users.filter(doc => text(doc, 'role') === 'Admin');
  const keep = new Set(admins.map(doc => doc.name.split('/').pop()));
  console.log(`users ${users.length}, administrator accounts kept ${admins.length}`);
  for (const name of ['students', 'accountLocks', 'portalSessions', 'outpasses', 'studentDirectory', 'adminAudit']) {
    if (!collections.includes(name)) { console.log('already absent', name); continue; }
    await new FirestoreDelete(project, name, { recursive: true, databaseId: '(default)' }).execute();
    console.log('cleared', name);
  }
  await removeDocs(users.filter(doc => !keep.has(doc.name.split('/').pop())));
  if (collections.includes('registerNumbers')) {
    const numbers = await allDocs('registerNumbers');
    await removeDocs(numbers.filter(doc => !keep.has(text(doc, 'uid'))));
    console.log('register numbers kept for administrators', numbers.filter(doc => keep.has(text(doc, 'uid'))).length);
  }
  const client = new Client({ auth: true, apiVersion: 'v1', urlPrefix: firestoreOrigin() });
  await client.post(`projects/${project}/databases/(default)/documents:commit`, { writes: [{ update: {
    name: `projects/${project}/databases/(default)/documents/adminAudit/collection-restored`,
    fields: {
      actorId: { stringValue: 'console' },
      targetId: { stringValue: 'adminAudit' },
      action: { stringValue: 'CREATE_USER' },
      at: { timestampValue: new Date().toISOString() },
      before: { nullValue: null },
      after: { mapValue: { fields: { note: { stringValue: 'adminAudit collection restored after it was deleted in the console.' } } } },
    },
  } }] });
  console.log('adminAudit restored');
  console.log('collections now:', (await firestore.listCollectionIds(project)).join(', '));
})().catch(error => { console.error(error?.message || error); process.exit(1); });
