import { fromBase64, fromBech32 } from '@cosmjs/encoding';
import _ from 'lodash';
import Long from 'long';
import { IPagination } from '../types/interfaces';

export default class Utils {
  public static isValidAddress(address: string, length = -1) {
    try {
      const decodeResult = fromBech32(address);
      if (length === -1) {
        return true;
      }
      if (decodeResult.data.length === length) {
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  public static isValidAccountAddress(
    address: string,
    prefix: string,
    length = -1
  ) {
    try {
      const decodeResult = fromBech32(address);
      if (length === -1) {
        return true;
      }
      if (
        decodeResult.data.length === length &&
        decodeResult.prefix === prefix
      ) {
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  public static flattenObject(obj: any): any {
    return Object.keys(obj).reduce((acc, k) => {
      if (
        typeof obj[k] === 'object' &&
        !Array.isArray(obj[k]) &&
        obj[k] &&
        k !== 'pub_key'
      )
        Object.assign(acc, Utils.flattenObject(obj[k]));
      else acc[k] = obj[k];
      return acc;
    }, {});
  }

  public static camelizeKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((v: any) => this.camelizeKeys(v));
    }
    if (obj != null && obj.constructor === Object) {
      return Object.keys(obj).reduce(
        (result, key) => ({
          ...result,
          [key === '@type' ? '@type' : _.snakeCase(key)]: this.camelizeKeys(
            obj[key]
          ),
        }),
        {}
      );
    }
    return obj;
  }

  public static isBase64(text: string): boolean {
    const base64Regex =
      /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    return base64Regex.test(text);
  }

  // use LCD to get list result with next key
  public static async getListResultWithNextKey(
    limitPerPage: number,
    endPointLCD: any,
    paramInput: any,
    fieldOutput: string
  ) {
    const pagination: IPagination = {
      limit: Long.fromInt(limitPerPage),
    };
    const results: any[] = [];
    let done = false;
    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      const resultCallApi = await endPointLCD({ ...paramInput, pagination });

      // check if has reference height, then set to all element in array
      if (resultCallApi.height) {
        resultCallApi[fieldOutput].forEach((element: any) => {
          // eslint-disable-next-line no-param-reassign
          element.height = resultCallApi.height;
        });
      }

      results.push(...resultCallApi[fieldOutput]);
      if (resultCallApi.pagination.next_key === null) {
        done = true;
      } else {
        pagination.key = fromBase64(resultCallApi.pagination.next_key);
      }
    }
    return results;
  }
}
