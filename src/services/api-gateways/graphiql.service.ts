import { Context, ServiceBroker } from 'moleculer';
import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import axios from 'axios';
import gql from 'graphql-tag';
import { DefinitionNode, FieldNode, OperationDefinitionNode } from 'graphql';
import BaseService from '../../base/base.service';
import { IContextGraphQLQuery, Config } from '../../common';
import { ResponseDto } from '../../common/types/response-api';
import config from '../../../config.json' assert { type: 'json' };
import queryWhitelist from '../../../graphql-query-whitelist.json' assert { type: 'json' };
import { ErrorCode, ErrorMessage } from '../../common/types/errors';
import Utils from '../../common/utils/utils';

@Service({
  name: 'graphql',
  version: 2,
  settings: {
    rateLimit: {
      window: config.graphiqlApi.rateLimitWindow,
      limit: config.graphiqlApi.rateLimitQuery,
      headers: true,
      key: (req: any) =>
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress,
    },
  },
})
export default class GraphiQLService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * call it with curl  --request POST 'http://0.0.0.0:3000/api/v1/graphiql'
   * Schema for validattion
   */
  @Post('/', {
    name: 'handleGraphQLQuery',
    params: {
      operationName: 'string',
      query: 'string',
      variables: 'any',
    },
  })
  async handleGraphQLQuery(
    ctx: Context<IContextGraphQLQuery>
  ): Promise<ResponseDto> {
    const { query } = ctx.params;

    let result: ResponseDto = {
      code: '',
      message: '',
      data: null,
    };
    let openBrackets = 0;
    let isWhere = false;
    for (let i = 0; i < query.length; i += 1) {
      if (query.charAt(i) === '(') isWhere = true;
      else if (query.charAt(i) === ')') isWhere = false;

      if (query.charAt(i) === '{' && !isWhere) openBrackets += 1;
      else if (query.charAt(i) === '}' && !isWhere) openBrackets -= 1;

      if (openBrackets > config.graphiqlApi.depthLimit + 2) {
        result = {
          code: ErrorCode.WRONG,
          message: ErrorMessage.VALIDATION_ERROR,
          errors: `The query depth must not be greater than ${config.graphiqlApi.depthLimit}`,
        };
        return result;
      }
    }

    let graphqlObj;
    try {
      graphqlObj = gql`
        ${query}
      `;
    } catch (error) {
      this.logger.error('Error parse GraphQL query');
      this.logger.error(error);
      result = {
        code: ErrorCode.WRONG,
        message: ErrorMessage.VALIDATION_ERROR,
        errors: 'Invalid query',
      };
    }
    this.logger.debug(JSON.stringify(graphqlObj));

    if (graphqlObj) {
      (graphqlObj.definitions as DefinitionNode[]).forEach(
        (definition: DefinitionNode) => {
          if (
            (definition as OperationDefinitionNode).operation !== 'query' &&
            definition.kind !== 'FragmentDefinition'
          )
            result = {
              code: ErrorCode.WRONG,
              message: ErrorMessage.VALIDATION_ERROR,
              errors:
                'This Horoscope GraphiQL service only allows query operations',
            };
        }
      );
      if (result.code !== '') return result;

      if (
        !queryWhitelist.includes(query.replaceAll(' ', '').replaceAll('\n', ''))
      ) {
        const selections = (
          graphqlObj.definitions[0] as OperationDefinitionNode
        ).selectionSet.selections as FieldNode[];
        selections.forEach((selection: FieldNode) => {
          (selection.selectionSet?.selections as FieldNode[]).forEach(
            (sel: FieldNode) => {
              const where = sel.arguments?.find(
                (arg) => arg.name.value === 'where'
              );

              if (where) {
                if (
                  Utils.getDepth(where) >
                  config.graphiqlApi.rootWhereDepthLimit + 1
                ) {
                  result = {
                    code: ErrorCode.WRONG,
                    message: ErrorMessage.VALIDATION_ERROR,
                    errors: `The root where query depth must not be greater than ${config.graphiqlApi.rootWhereDepthLimit}`,
                  };
                }
              }

              if (result.code === '') {
                const subWhere = Utils.filterWhereQuery(sel.selectionSet);
                subWhere.forEach((sub: any) => {
                  if (
                    Utils.getDepth(sub) >
                    config.graphiqlApi.subWhereDepthLimit + 1
                  ) {
                    result = {
                      code: ErrorCode.WRONG,
                      message: ErrorMessage.VALIDATION_ERROR,
                      errors: `The sub where query depth must not be greater than ${config.graphiqlApi.subWhereDepthLimit}`,
                    };
                  }
                });
              }

              if (result.code === '') {
                const [checkCondition, error] = Utils.checkCondition(
                  sel,
                  config.graphiqlApi.queryNeedCondition
                );
                // const [heightCondition, heightRange] =
                //   Utils.isQueryNeedCondition(
                //     sel,
                //     config.graphiqlApi.queryNeedWhereModel,
                //     config.graphiqlApi.queryNeedWhereRelation,
                //     config.graphiqlApi.queryNeedWhereCondition.map(
                //       (c) => c.field
                //     )
                //   );
                if (!checkCondition) {
                  result = {
                    code: ErrorCode.WRONG,
                    message: ErrorMessage.VALIDATION_ERROR,
                    errors: `The query to one of the following tables needs to include exact height (_eq) or a height range (_gt/_gte & _lt/_lte) in where argument: ${config.graphiqlApi.queryNeedWhereModel}`,
                  };
                }
                if (error) {
                  result = {
                    code: ErrorCode.WRONG,
                    message: ErrorMessage.VALIDATION_ERROR,
                    errors: error,
                  };
                }
              }
            }
          );
        });
        if (result.code !== '') return result;
      }

      try {
        const response = await axios({
          url: config.graphiqlApi.hasuraGraphQL,
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Config.HASURA_JWT}`,
            'X-Hasura-Role': config.graphiqlApi.hasuraRole,
          },
          data: ctx.params,
        });
        if (response.data.data) {
          result = {
            code: ErrorCode.SUCCESSFUL,
            message: ErrorMessage.SUCCESSFUL,
            data: response.data.data,
          };
        } else {
          result = {
            code: ErrorCode.BAD_REQUEST,
            message: ErrorMessage.BAD_REQUEST,
            errors: response.data.errors,
          };
        }
      } catch (error: any) {
        this.logger.error('Error execute GraphQL query');
        this.logger.error(error);
        result = {
          code: error.code,
          message: error.message,
          errors: error,
        };
      }
    }

    return result;
  }
}
