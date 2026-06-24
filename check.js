const initSqlJs = require('sql.js');
const { readFileSync, writeFileSync } = require('fs');

initSqlJs().then(SQL => {
  const db = new SQL.Database(readFileSync('E:/dlc项目/自己的项目/Claude code连接微信/data/chat.db'));
  const r = db.exec('SELECT length(content) FROM knowledge');
  const contentLen = r[0]?.values[0][0];
  console.log('Content length:', contentLen);
  
  const r2 = db.exec('SELECT substr(content, 1, 200) FROM knowledge');
  console.log('Content preview:', r2[0]?.values[0][0]);
}).catch(e => console.error(e));
