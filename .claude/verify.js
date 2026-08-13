/**
 * 中国象棋 — 项目验收脚本 v1.0
 * 运行: node .claude/verify.js
 * 覆盖维度: ①文件完整性 ②JS语法 ③棋盘逻辑 ④AI联调 ⑤P2P联机API
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RESULTS_FILE = path.join(ROOT, 'verify-results.json');

const results = {
  project: '中国象棋',
  version: 'unknown',
  timestamp: new Date().toISOString(),
  checks: [],
  summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
};

function addCheck(name, pass, data) {
  results.checks.push({ name, pass, data: data || {} });
  results.summary.total++;
  if (pass === true) results.summary.passed++;
  else if (pass === false) results.summary.failed++;
  else results.summary.skipped++;
}

// ====== 维度1: 文件完整性 ======
console.log('=== 维度1: 文件完整性 ===\n');

const REQUIRED_FILES = [
  'index.html', 'manifest.json', 'sw.js',
  'css/style.css',
  'js/board.js', 'js/ai.js', 'js/main.js', 'js/ui.js', 'js/p2p.js', 'js/particles.js'
];

for (const f of REQUIRED_FILES) {
  const fp = path.join(ROOT, f);
  const exists = fs.existsSync(fp);
  const size = exists ? fs.statSync(fp).size : 0;
  addCheck(`文件存在: ${f}`, exists, { size_bytes: size });
  if (!exists) console.error(`  ✗ 缺失: ${f}`);
}

// 版本号提取
try {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  const vMatch = html.match(/v(\d+\.\d+)/);
  if (vMatch) {
    results.version = 'v' + vMatch[1];
    addCheck('版本号可提取', true, { version: results.version });
  } else {
    addCheck('版本号可提取', false);
  }
} catch (e) {
  addCheck('index.html 可读', false, { error: e.message });
}

// ====== 维度2: JS 语法正确性 ======
console.log('\n=== 维度2: JS 语法正确性 ===\n');

const JS_FILES = ['js/board.js', 'js/ai.js', 'js/main.js', 'js/ui.js', 'js/p2p.js', 'js/particles.js'];
let totalJsSize = 0;
let syntaxOk = true;
const syntaxErrors = [];

for (const f of JS_FILES) {
  const fp = path.join(ROOT, f);
  try {
    const code = fs.readFileSync(fp, 'utf-8');
    totalJsSize += code.length;
    // node --check 只检查语法，不执行
    execSync(`node --check "${fp}"`, { stdio: 'pipe' });
  } catch (e) {
    syntaxOk = false;
    const msg = e.stderr ? e.stderr.toString().trim() : e.message;
    syntaxErrors.push({ file: f, error: msg });
    console.error(`  ✗ 语法错误: ${f}`);
    console.error(`    ${msg.split('\n')[0]}`);
  }
}

addCheck('所有 JS 文件语法正确', syntaxOk, {
  total_js_size: totalJsSize,
  files_checked: JS_FILES.length,
  errors: syntaxErrors
});

// ====== 维度3: 棋盘逻辑单元测试 ======
console.log('\n=== 维度3: 棋盘逻辑 (test_board.js) ===\n');

try {
  const boardTest = path.join(ROOT, 'test_board.js');
  const out = execSync(`node "${boardTest}"`, {
    stdio: 'pipe', timeout: 30000, encoding: 'utf-8'
  });
  const boardMatch = out.match(/(\d+)\s*通过,\s*(\d+)\s*失败/);
  const boardPassed = boardMatch ? parseInt(boardMatch[1]) : 0;
  const boardFailed = boardMatch ? parseInt(boardMatch[2]) : 99;
  addCheck('棋盘逻辑单元测试', boardFailed === 0, {
    passed: boardPassed, failed: boardFailed, output_preview: out.trim().split('\n').slice(-3).join('\n')
  });
  console.log(out.trim().split('\n').slice(-1)[0]);
} catch (e) {
  addCheck('棋盘逻辑单元测试', false, { error: e.stderr ? e.stderr.toString().slice(0, 500) : e.message });
  console.error('  ✗ 运行失败:', e.message);
}

// ====== 维度4: AI 联调测试 ======
console.log('\n=== 维度4: AI 联调 (test_ai.js) ===\n');

try {
  const aiTest = path.join(ROOT, 'test_ai.js');
  const out = execSync(`node "${aiTest}"`, {
    stdio: 'pipe', timeout: 60000, encoding: 'utf-8'
  });
  const aiMatch = out.match(/(\d+)\s*通过,\s*(\d+)\s*失败/);
  const aiPassed = aiMatch ? parseInt(aiMatch[1]) : 0;
  const aiFailed = aiMatch ? parseInt(aiMatch[2]) : 99;
  addCheck('AI 联调测试', aiFailed === 0, {
    passed: aiPassed, failed: aiFailed, output_preview: out.trim().split('\n').slice(-3).join('\n')
  });
  console.log(out.trim().split('\n').slice(-1)[0]);
} catch (e) {
  addCheck('AI 联调测试', false, { error: e.stderr ? e.stderr.toString().slice(0, 500) : e.message });
  console.error('  ✗ 运行失败:', e.message);
}

// ====== 维度5: P2P 联机 API 验证 ======
console.log('\n=== 维度5: P2P 联机 API (test_p2p.js) ===\n');

try {
  const p2pTest = path.join(ROOT, 'test_p2p.js');
  const out = execSync(`node "${p2pTest}"`, {
    stdio: 'pipe', timeout: 30000, encoding: 'utf-8'
  });
  const p2pMatch = out.match(/(\d+)\s*通过,\s*(\d+)\s*失败/);
  const p2pPassed = p2pMatch ? parseInt(p2pMatch[1]) : 0;
  const p2pFailed = p2pMatch ? parseInt(p2pMatch[2]) : 99;
  addCheck('P2P 联机 API 验证', p2pFailed === 0, {
    passed: p2pPassed, failed: p2pFailed, output_preview: out.trim().split('\n').slice(-3).join('\n')
  });
  console.log(out.trim().split('\n').slice(-1)[0]);
} catch (e) {
  addCheck('P2P 联机 API 验证', false, { error: e.stderr ? e.stderr.toString().slice(0, 500) : e.message });
  console.error('  ✗ 运行失败:', e.message);
}

// ====== 汇总 ======
console.log(`\n${'='.repeat(50)}`);
console.log(`验收结果: ${results.summary.passed}/${results.summary.total} 通过`);
if (results.summary.failed > 0) {
  console.log(`失败项 (${results.summary.failed}):`);
  for (const c of results.checks) {
    if (c.pass === false) console.log(`  ✗ ${c.name}`);
  }
}
console.log(`${'='.repeat(50)}\n`);

// 写入结果文件
fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf-8');
console.log(`结果已写入: ${RESULTS_FILE}`);

process.exit(results.summary.failed > 0 ? 1 : 0);
