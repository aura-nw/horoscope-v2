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

  public static getDepth(object: any): number {
    return Object(object) === object
      ? (object.kind &&
        object.kind === 'ObjectField' &&
        !object.name.value.match('^_.')
          ? 1
          : 0) + Math.max(-1, ...Object.values(object).map(Utils.getDepth))
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
          if (value.kind === 'Argument' && value.name.value === 'where') {
            result.push(value);
          }
        }
      });
    };

    iterate(object);
    return result;
  }

  public static isQueryNeedCondition(
    object: any,
    models: string[],
    relations: string[],
    condition: string[]
  ): [boolean, number] {
    const result: any[] = [];
    const resultRelations: any[] = [];
    let whereHeight: any = null;
    let response = true;
    let heightRange = 0;

    if (object.kind === 'Field' && models.includes(object.name.value)) {
      result.push(object);
    }

    const extractFieldNeedHeightArgument = (obj: any) => {
      if (!obj) {
        return;
      }
      Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          extractFieldNeedHeightArgument(value);
          if (value.kind === 'Field' && relations.includes(value.name.value)) {
            result.push(value);
          } else if (
            value.kind === 'ObjectField' &&
            relations.includes(value.name.value)
          ) {
            resultRelations.push(value);
          }
        }
      });
    };

    const findConditionInObj = (res: any): any => {
      if (!res) {
        return;
      }
      Object.keys(res).forEach((key) => {
        const value = res[key];
        if (typeof value === 'object' && value !== null) {
          findConditionInObj(value);
          if (
            value.kind === 'ObjectField' &&
            condition.includes(value.name.value)
          ) {
            whereHeight = value;
          }
        }
      });
    };

    const checkCondition = (res: any) => {
      findConditionInObj(res);
      if (whereHeight) {
        const isEqual = whereHeight.value.fields.find(
          (field: any) => field.name.value === '_eq'
        );
        if (isEqual) return true;

        const upperLimit = whereHeight.value.fields.find(
          (field: any) =>
            field.name.value === '_lt' || field.name.value === '_lte'
        );
        const lowerLimit = whereHeight.value.fields.find(
          (field: any) =>
            field.name.value === '_gt' || field.name.value === '_gte'
        );
        const isRange = lowerLimit && upperLimit;
        if (isRange) {
          heightRange = Math.max(
            Math.abs(
              Number(upperLimit.value.value) - Number(lowerLimit.value.value)
            ),
            heightRange
          );
          return true;
        }
      }
      return false;
    };

    extractFieldNeedHeightArgument(object);
    if (result.length > 0) {
      response = result.some((res: any) => {
        const where = res.arguments.find(
          (arg: any) => arg.name.value === 'where'
        );
        if (where) return checkCondition(where);
        return false;
      });
    }
    if (resultRelations.length > 0) {
      response = resultRelations.some(checkCondition);
    }

    return [response, heightRange];
  }
}
