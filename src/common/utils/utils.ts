import { fromBech32 } from '@cosmjs/encoding';
import { FieldNode, Kind, ObjectFieldNode } from 'graphql';
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

  public static checkCondition(
    object: FieldNode,
    queryNeedCondition: {
      model: string[];
      relation: string[];
      condition: { field: string; range: number; type: string }[];
    }[]
  ): [boolean, string | null] {
    let error: string | null = null;
    // check object field node match at least one condition in queryNeedCondition
    const response = queryNeedCondition.some((itemCondition) => {
      function recursive(
        fieldNode: FieldNode | ObjectFieldNode,
        relationFields: FieldNode[] | null,
        relationObjectFields: ObjectFieldNode[] | null,
        conditionObjectFields: ObjectFieldNode[] | null
      ) {
        if (!fieldNode) {
          return;
        }
        if (
          fieldNode.kind === Kind.FIELD &&
          itemCondition.model.includes(fieldNode.name.value)
        ) {
          relationFields?.push(fieldNode);
        }
        Object.keys(fieldNode).forEach((key) => {
          const value = fieldNode[key];
          if (typeof value === 'object' && value !== null) {
            recursive(
              value,
              relationFields,
              relationObjectFields,
              conditionObjectFields
            );
            if (
              value.kind === Kind.FIELD &&
              itemCondition.relation.includes(value.name.value)
            ) {
              relationFields?.push(value);
            } else if (
              value.kind === Kind.OBJECT_FIELD &&
              itemCondition.relation.includes(value.name.value)
            ) {
              relationObjectFields?.push(value);
            } else if (
              value.kind === Kind.OBJECT_FIELD &&
              itemCondition.condition
                .map((e) => e.field)
                .includes(value.name.value)
            ) {
              conditionObjectFields?.push(value);
            }
          }
        });
      }

      // get relation fields and relation objectfields with config
      const relationFields: FieldNode[] = [];
      const relationObjectFields: ObjectFieldNode[] = [];
      recursive(object, relationFields, relationObjectFields, null);

      // function to check condition where in model or relation
      function checkConditionWhere(fieldNode: ObjectFieldNode) {
        const conditionObjectFields: ObjectFieldNode[] = [];
        recursive(fieldNode, null, null, conditionObjectFields);

        if (conditionObjectFields.length === 0) return false;

        return conditionObjectFields.every((field: any) => {
          const isEqual = field.value.fields.find(
            (field: any) => field.name.value === '_eq'
          );
          if (isEqual) return true;
          const upperLimit = field.value.fields.find(
            (field: any) =>
              field.name.value === '_lt' || field.name.value === '_lte'
          );
          const lowerLimit = field.value.fields.find(
            (field: any) =>
              field.name.value === '_gt' || field.name.value === '_gte'
          );
          const isRange = lowerLimit && upperLimit;
          if (isRange) {
            const conditionConfig = itemCondition.condition.find(
              (condition) => condition.field === field.name.value
            );
            if (conditionConfig) {
              let range = 0;
              if (conditionConfig.type === 'number') {
                range = Math.abs(
                  Number(upperLimit.value.value) -
                    Number(lowerLimit.value.value)
                );
              } else if (conditionConfig.type === 'date') {
                range = Math.abs(
                  new Date(upperLimit.value.value).getTime() / 1000 -
                    new Date(lowerLimit.value.value).getTime() / 1000
                );
              }
              if (range > conditionConfig.range) {
                error = `The query range on field ${conditionConfig.field} needs to be less than ${conditionConfig.range}`;
                return false;
              }
            }
          }
          return true;
        });
      }

      if (relationFields.length > 0) {
        // check all relation fields with condition where
        return relationFields.every((field: any) => {
          const where = field.arguments?.find(
            (arg: any) => arg.name.value === 'where'
          );
          if (where) return checkConditionWhere(where);
          return false;
        });
      }
      if (relationObjectFields.length > 0) {
        // check all relation object fields with condition where
        return relationObjectFields.every(checkConditionWhere);
      }
      return true;
    });
    return [response, error];
  }
}
