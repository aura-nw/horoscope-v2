/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/dot-notation */

// import { inspect } from 'util';
// import {set} from 'lodash';

const openApiKey = 'openapi';
// const responsesKey = 'responses';
export const Summary = function (summary: string) {
  return (target: any, _key: string, _descriptor: PropertyDescriptor) => {
    const obj = target.actions[_key][openApiKey] || {};

    target.actions[_key][openApiKey] = {
      ...obj,
      summary,
    };
  };
};

// TODO: WIP, experiment only, bug when changes order of Summary and Response in action declaration
// Refactor with lodash
export const Response = function (
  code: number,
  description: string,
  responseObject: any
) {
  return (target: any, _key: string, _descriptor: PropertyDescriptor) => {
    // define response entry
    if (!target.actions[_key][openApiKey]['responses'])
      target.actions[_key][openApiKey]['responses'] = {};

    // let obj = target.actions[_key][openApiKey]['responses'][code] || {};
    const obj = {
      description,
      content: {
        'application/json': {
          schema: responseObject,
        },
      },
    };

    console.log(JSON.stringify(target.actions[_key][openApiKey]['responses']));
    target.actions[_key][openApiKey]['responses'][code] = obj;
  };
};

// export const ResponseObject(description: string, )
//
// function createProp(prop: string);
