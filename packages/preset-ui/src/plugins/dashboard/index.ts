import * as path from 'path';
import * as fs from 'fs';
import p from 'immer';
import assert from 'assert';
import { IApi, utils } from 'umi';

const { got, mkdirp } = utils;

export default (api: IApi) => {
  const getDataPath = dbPath => path.join(dbPath, 'dashboard.json');

  const writeData = (dbPath, data = []) => {
    const dbDataPath = getDataPath(dbPath);
    fs.writeFileSync(dbDataPath, JSON.stringify(data, null, 2), 'utf-8');
  };

  const getData = async dbPath => {
    assert(dbPath, `dbPath must be supplied, received: ${dbPath}.`);

    if (!fs.existsSync(dbPath)) {
      mkdirp.sync(dbPath);
    }
    const dbData = getDataPath(dbPath);
    if (!fs.existsSync(dbData)) {
      writeData(dbPath);
    }
    // remove cache
    delete require.cache[dbData];
    let list = [];
    try {
      // eslint-disable-next-line import/no-dynamic-require
      list = require(dbData);
    } catch (e) {
      console.error('dbData requrie error', e);
    }
    if (!Array.isArray(list)) {
      // reset data into right structure
      writeData(dbPath);
      return [];
      // throw new Error(`dbData error ${JSON.stringify(list)}`);
    }
    return list || [];
  };

  api.onUISocket(async ({ action, failure, success, send }) => {
    const { type, payload = {}, lang } = action;
    switch (type) {
      case 'org.umi.dashboard.card.list': {
        try {
          const { dbPath } = payload;
          const list = await getData(dbPath);
          success(list);
        } catch (e) {
          failure(e);
        }
        break;
      }
      case 'org.umi.dashboard.card.list.change': {
        try {
          const { dbPath, key, enable } = payload;
          const list = await getData(dbPath);
          // [ { key: '', enable: false } ]
          const newList = p(list, draft => {
            const cardIndex = draft.findIndex(item => item.key === key);
            const newCardData = {
              key,
              enable: !!enable,
            };
            if (cardIndex > -1 && draft[cardIndex]) {
              // delete
              draft.splice(cardIndex, 1);
            }
            draft.push(newCardData);
            return draft;
          });
          writeData(dbPath, newList);
          success(newList);
        } catch (e) {
          failure(e);
        }
        break;
      }
      default:
        break;
    }
  });
  api.addUIPlugin(() => require.resolve('../../../dist/dashboard.umd'));
};
