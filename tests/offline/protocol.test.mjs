import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function connect(t) {
  const client = new Client({ name: 'offline-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: ['--import', './tests/offline/mock-api.mjs', 'dist/index.js'],
    env: { PATH: process.env.PATH, SEVDESK_API_TOKEN: 'synthetic-token' }, stderr: 'pipe' });
  t.after(() => client.close());
  await client.connect(transport);
  return client;
}

const booking = { amount: 10, date: '1700000000', type: 'N', checkAccountId: 1 };
const cases = [
  ['list_contacts', { name: 'Fixture', limit: 5 }, 'GET', '/Contact'],
  ['get_contact', { contactId: 1 }, 'GET', '/Contact/1'],
  ['create_contact', { name: 'Fixture', categoryId: 3 }, 'POST', '/Contact'],
  ['update_contact', { contactId: 1, name: 'Updated' }, 'PUT', '/Contact/1'],
  ['delete_contact', { contactId: 1 }, 'DELETE', '/Contact/1'],
  ['list_invoices', { status: '200' }, 'GET', '/Invoice'],
  ['get_invoice', { invoiceId: 1 }, 'GET', '/Invoice/1'],
  ['get_invoice_pdf', { invoiceId: 1, preventSendBy: true }, 'GET', '/Invoice/1/getPdf'],
  ['send_invoice_by_email', { invoiceId: 1, toEmail: 'fixture@example.invalid', subject: 'Fixture', text: 'Body', bccEmail: 'bcc@example.invalid' }, 'POST', '/Invoice/1/sendViaEmail'],
  ['mark_invoice_as_sent', { invoiceId: 1 }, 'PUT', '/Invoice/1/sendBy'],
  ['book_invoice', { invoiceId: 1, ...booking }, 'PUT', '/Invoice/1/bookAmount'],
  ['cancel_invoice', { invoiceId: 1 }, 'POST', '/Invoice/1/cancelInvoice'],
  ['list_vouchers', { status: '100', creditDebit: 'D' }, 'GET', '/Voucher'],
  ['get_voucher', { voucherId: 1 }, 'GET', '/Voucher/1'],
  ['book_voucher', { voucherId: 1, ...booking }, 'PUT', '/Voucher/1/bookAmount'],
  ['get_voucher_positions', { voucherId: 1 }, 'GET', '/VoucherPos'],
  ['upload_voucher_file', { voucherId: 1, fileName: 'fixture.pdf', base64Content: 'Zml4dHVyZQ==' }, 'POST', '/Voucher/Factory/uploadTempFile'],
  ['list_check_accounts', {}, 'GET', '/CheckAccount'],
  ['get_check_account', { checkAccountId: 1 }, 'GET', '/CheckAccount/1'],
  ['get_check_account_balance', { checkAccountId: 1, date: '1700000000' }, 'GET', '/CheckAccount/1/getBalanceAtDate'],
  ['list_transactions', { checkAccountId: 1, isBooked: false }, 'GET', '/CheckAccountTransaction'],
  ['get_transaction', { transactionId: 1 }, 'GET', '/CheckAccountTransaction/1'],
  ['create_transaction', { checkAccountId: 1, amount: 10, valueDate: '2026-01-01' }, 'POST', '/CheckAccountTransaction'],
  ['list_parts', {}, 'GET', '/Part'],
  ['get_part', { partId: 1 }, 'GET', '/Part/1'],
  ['create_part', { name: 'Fixture', priceGross: 12.5 }, 'POST', '/Part'],
  ['update_part', { partId: 1, stock: 0, stockEnabled: false, priceNet: 0 }, 'PUT', '/Part/1'],
  ['get_part_stock', { partId: 1 }, 'GET', '/Part/1/getStock'],
  ['list_tags', {}, 'GET', '/Tag'],
  ['get_tag', { tagId: 1 }, 'GET', '/Tag/1'],
  ['create_tag', { name: 'Fixture', objectId: 1, objectName: 'Invoice' }, 'POST', '/Tag/Factory/create'],
  ['update_tag', { tagId: 1, name: 'Updated' }, 'PUT', '/Tag/1'],
  ['delete_tag', { tagId: 1 }, 'DELETE', '/Tag/1'],
  ['list_tag_relations', {}, 'GET', '/TagRelation'],
];

test('all 34 tools preserve discovery and authenticated HTTP dispatch after the Zod update', async t => {
  const client = await connect(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(x => x.name).sort(), cases.map(x => x[0]).sort());
  const schema = name => tools.find(x => x.name === name).inputSchema;
  assert.deepEqual(schema('list_invoices').properties.status.enum, ['100', '200', '1000']);
  assert.deepEqual(schema('create_tag').properties.objectName.enum, ['Invoice', 'Voucher', 'Order', 'CreditNote']);
  assert.deepEqual(schema('book_invoice').properties.type.enum, ['N', 'CB', 'CF', 'O', 'OF', 'MF', 'C']);
  assert.deepEqual(schema('get_contact').required, ['contactId']);
  assert.equal(schema('list_contacts').required, undefined);
  for (const [name, args, method, path] of cases) {
    const response = await client.callTool({ name, arguments: args });
    assert.ok(!response.isError, name + ': ' + JSON.stringify(response));
    const result = JSON.parse(response.content[0].text);
    assert.equal(result.method, method, name);
    assert.equal(result.path, path, name);
    if (name === 'create_contact') assert.deepEqual(result.body.category, { id: 3, objectName: 'Category' });
    if (name === 'book_invoice' || name === 'book_voucher') {
      assert.equal(result.body.amount, 10);
      assert.deepEqual(result.body.checkAccount, { id: 1, objectName: 'CheckAccount' });
    }
    if (name === 'send_invoice_by_email') assert.equal(result.body.bccEmail, args.bccEmail);
    if (name === 'mark_invoice_as_sent') assert.equal(result.query.sendType, 'VM');
    if (name === 'upload_voucher_file') assert.deepEqual(result.body, { content: args.base64Content, filename: 'fixture.pdf', base64: true, creditDebit: 'D' });
    if (name === 'update_part') assert.deepEqual(result.body, { stock: 0, stockEnabled: false, priceNet: '0' });
    if (name === 'create_part') assert.equal(result.body.priceGross, '12.5');
    if (name === 'list_transactions') assert.equal(result.query.isBooked, 'false');
  }
});

test('invalid inputs and enum values fail before HTTP with structured parameter errors', async t => {
  const client = await connect(t);
  for (const [name, args] of [
    ['get_contact', { contactId: 'wrong' }],
    ['create_contact', {}],
    ['list_invoices', { status: 'invalid' }],
    ['create_tag', { name: 'Fixture', objectId: 1, objectName: 'Invalid' }],
    ['book_invoice', { invoiceId: 1, ...booking, amount: 'wrong' }],
  ]) {
    await assert.rejects(client.callTool({ name, arguments: args }), error => {
      assert.equal(error.code, -32602);
      assert.match(error.message, /Invalid parameters/);
      return true;
    });
  }
  await assert.rejects(client.callTool({ name: 'unknown_tool', arguments: {} }), /Unknown tool/);
  const response = await client.callTool({ name: 'get_contact', arguments: { contactId: 1 } });
  assert.equal(JSON.parse(response.content[0].text).count, 1);
});

test('provider errors retain the error response without leaking the synthetic token', async t => {
  const client = await connect(t);
  const response = await client.callTool({ name: 'get_contact', arguments: { contactId: 999 } });
  assert.equal(response.isError, true);
  assert.match(response.content[0].text, /Synthetic provider error/);
  assert.ok(!JSON.stringify(response).includes('synthetic-token'));
});
