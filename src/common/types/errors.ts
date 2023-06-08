import { constants } from 'http2';

export enum ErrorMessage {
  SUCCESSFUL = 'Successful',
  NOT_FOUND = 'Not Found',
  WRONG = 'Wrong',
  VALIDATION_ERROR = 'Validation Error',
  BAD_REQUEST = 'Bad Request',
}

export const ErrorCode = {
  SUCCESSFUL: constants.HTTP_STATUS_OK,
  NOT_FOUND: constants.HTTP_STATUS_NOT_FOUND,
  WRONG: constants.HTTP_STATUS_UNPROCESSABLE_ENTITY,
  BAD_REQUEST: constants.HTTP_STATUS_BAD_REQUEST,
  NOT_ACTIVE: constants.HTTP_STATUS_FORBIDDEN,
};
