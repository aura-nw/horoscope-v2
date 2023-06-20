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
  ): boolean {
    const result: any[] = [];
    const resultRelations: any[] = [];
    let response = true;

    if (object.kind === 'Field' && models.includes(object.name.value))
      result.push(object);

    const iterate = (obj: any) => {
      if (!obj) {
        return;
      }
      Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          iterate(value);
          if (value.kind === 'Field' && relations.includes(value.name.value))
            result.push(value);
          else if (
            value.kind === 'ObjectField' &&
            relations.includes(value.name.value)
          )
            resultRelations.push(value);
        }
      });
    };

    iterate(object);
    result.forEach((res: any) => {
      const where = res.arguments.find(
        (arg: any) => arg.name.value === 'where'
      );
      if (!where) response = false;
      else {
        const whereHeight = where.value.fields.find((field: any) =>
          condition.includes(field.name.value)
        );
        if (!whereHeight) response = false;
        else {
          const isRange =
            whereHeight.value.fields.find(
              (field: any) => field.name.value === '_eq'
            ) ||
            (whereHeight.value.fields.find(
              (field: any) =>
                field.name.value === '_lt' || field.name.value === '_lte'
            ) &&
              whereHeight.value.fields.find(
                (field: any) =>
                  field.name.value === '_gt' || field.name.value === '_gte'
              ));
          if (!isRange) response = false;
        }
      }
    });
    resultRelations.forEach((res: any) => {
      const whereHeight = res.value.fields.find((field: any) =>
        condition.includes(field.name.value)
      );
      if (!whereHeight) response = false;
      else {
        const isRange =
          whereHeight.value.fields.find(
            (field: any) => field.name.value === '_eq'
          ) ||
          (whereHeight.value.fields.find(
            (field: any) =>
              field.name.value === '_lt' || field.name.value === '_lte'
          ) &&
            whereHeight.value.fields.find(
              (field: any) =>
                field.name.value === '_gt' || field.name.value === '_gte'
            ));
        if (!isRange) response = false;
      }
    });

    return response;
  }
}
