import { fromBech32 } from '@cosmjs/encoding';
import _ from 'lodash';

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

  public static getDepth(object: any): number {
    return Object(object) === object
      ? 1 + Math.max(-1, ...Object.values(object).map(Utils.getDepth))
      : 0;
  }

  public static filterWhereQuery(object: any): any[] {
    const result: any[] = [];

    const iterate = (obj: any) => {
      if (!obj) {
        return;
      }
      Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          iterate(value);
          if (value.kind === 'Argument') {
            result.push(value);
          }
        }
      });
    };

    iterate(object);
    return result;
  }
}
