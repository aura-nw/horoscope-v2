export interface ResponseDto {
  code: number | string;
  message: string;
  data?: any;
  errors?: any;
}
