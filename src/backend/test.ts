import { fork } from 'child_process';
import path from 'path';

// const bootstrap = '/ip4/104.238.183.248/tcp/36491/p2p/QmNeTthdR1Y44NnEiWbVxE8MwW9MPbS9LAH71tZ17M95E3';
// const bootstrap = '/ip4/124.71.113.7/tcp/36491/p2p/QmZtDcGMnBXaZUdteugL6dAWU6UWUYphxCyaMpC7DsoMc7';
// const bootstrap = '/ip4/192.168.2.124/tcp/36491/p2p/QmZtDcGMnBXaZUdteugL6dAWU6UWUYphxCyaMpC7DsoMc7';
fork(path.join(__dirname, 'app.ts'), ['./config.local_a.js']);
// fork(path.join(__dirname, 'app.js'), ['./config.local_b.js']);
// setTimeout(() => fork(path.join(__dirname, 'app.js'), ['./config.local_b.js']), 300);
// setTimeout(() => fork(path.join(__dirname, 'app.js'), ['./config.local_c.js']), 300);