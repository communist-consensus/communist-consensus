import mysql from 'mysql';
import { Request } from 'express';
import express from 'express';
import bodyParser from 'body-parser';
import {
  Action,
  ActionType,
  InitialParams,
  NodeID,
  Profile,
  ConsensusConfig,
  VITaskType,
} from '../../shared/types';
import { createContext } from './bft/waterbear';
import {
  b64_to_uint8array,
  decode,
  encode,
  random,
  utf8_to_uint8array,
} from '../../shared/utils';
import EventEmitter from 'events';

let ready = false;
export const listener = new EventEmitter();
export function get_ready() {
  return ready;
}
const app = express();
app.listen(4000, async () => {
  ready = true;
  console.log('app ready');
  listener.emit('ready');
});
app.on('error', (err) => {
  console.log(err);
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('dist/frontend'));

app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', `http://localhost:8080`);
  res.header(
    'Access-Control-Allow-Method',
    'GET, PUT, POST, DELETE, HEAD, OPTIONS',
  );
  res.header('Access-Control-Allow-Headers', 'content-type');
  next();
});
