import type { ErrorState, FieldFunctionValidator } from './core';

export function sequence<Values extends Record<string, any>, Field extends keyof Values>
(
  ...validators: Array<FieldFunctionValidator<Values, Field>>
): FieldFunctionValidator<Values, Field> {
  return async (value, error, values, errors, trigger) => {
    for (const validator of validators) {
      await validator(value, error, values, errors, trigger);
    }
  }
}

export function parallel<Values extends Record<string, any>, Field extends keyof Values>(
  ...validators: Array<FieldFunctionValidator<Values, Field>>
): FieldFunctionValidator<Values, Field> {
  return async (value, error, values, errors, trigger) => {
    await Promise.all(validators.map(validator => async () => {
      await validator(value, error, values, errors, trigger);
    }));
  }
}

type OptionString = string | undefined | null;

export function required(message = 'Required') {
  return (value: OptionString): void => {
    if (!value) {
      throw message;
    }
  }
}

export function trimmed(message = 'Must be Trimmed') {
  return (value: OptionString): void => {
    if (value && value.trim() !== value) {
      throw message;
    }
  }
}

export function sameWith<Values extends Record<string, any>>(field: keyof Values, message?: string) {
  return (value: OptionString, _: ErrorState, values: Values): void => {
    if ((!value && !values[field]) || value !== values[field]) {
      throw message || `Should same with ${field}`;
    }
  }
}

export function sameWithWhenExists<Values extends Record<string, any>>(field: keyof Values, message?: string) {
  return (value: OptionString, _: ErrorState, values: Values): void => {
    if (values[field] && value !== values[field]) {
      throw message || `Should same with ${field}`;
    }
  }
}

export const REG_EMAIL = /^((([a-z]|\d|[!#$%&'*+\-/=?^_`{|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#$%&'*+\-/=?^_`{|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)(((([\x20\x09])*(\x0d\x0a))?([\x20\x09])+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*((([\x20\x09])*(\x0d\x0a))?([\x20\x09])+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
export const REG_SPECIAL = /[`~!@#$%^&*()\-_=+[\]{}\\|;:'",<.>/?]+/;
export function isEmail(message = 'Invalid email') {
  return (value: OptionString): void => {
    if (value && !REG_EMAIL.test(value)) {
      throw message;
    }
  }
}

function globalRegExp(input: RegExp) {
  const pattern = input.source;
  let flags = 'g';
  // Test for ignoreCase.
  if ( input.ignoreCase) {
    flags += 'i';
  }
  // Test for multiline.
  if (input.multiline) {
    flags += 'm';
  }
  // Return a clone with the additive flags.
  return new RegExp(pattern, flags);
}

export function composedOf(message = 'Invalid input', ...parts: RegExp[]): (value: OptionString) => void {
  const copyParts: RegExp[] = parts.map(part => globalRegExp(part));
  return (value: OptionString): void => {
    if (value) {
      let strValue = value;
      for (const part of copyParts) {
        strValue = strValue.replace(part, '');
      }
      if (strValue) {
        throw message;
      }
    }
  }
}

export function matchSomeOf(message?: string, ...parts: RegExp[]) {
  return (value: OptionString): void => {
    if (value) {
      let test = false;
      for (const part of parts) {
        if (part.test(value)) {
          test = true;
          break;
        }
      }
      if (!test) {
        throw message || `Must matches ${parts.map(reg => `/${reg.source}/`)}`;
      }
    }
  }
}

export function notMatchSomeOf(message?: string, ...parts: RegExp[]) {
  return (value: OptionString): void => {
    if (value) {
      let test = true;
      for (const part of parts) {
        if (!part.test(value)) {
          test = false;
          break;
        }
      }
      if (test) {
        throw message || `Must matches ${parts.map(reg => `/${reg.source}/`)}`;
      }
    }
  }
}

export function max(num: number, message?: string) {
  return (value: OptionString): void => {
    if (value && value.length > num) {
      throw message || `Should be shorter or equal than ${num}`;
    }
  }
}

export function min(num: number, message?: string) {
  return (value: OptionString): void => {
    if (value && value.length < num) {
      throw message || `Should be longer or equal than ${num}`;
    }
  }
}

type StringValidator<Values extends Record<string, any>, Field extends keyof Values> = FieldFunctionValidator<Values, Field> & {
  required: (message?: string) => StringValidator<Values, Field>;
  trimmed: (message?: string) => StringValidator<Values, Field>;
  sameWith: (field: keyof Values, message?: string) => StringValidator<Values, Field>;
  sameWithWhenExists: (field: keyof Values, message?: string) => StringValidator<Values, Field>;
  isEmail: (message?: string) => StringValidator<Values, Field>;
  composedOf: (message?: string, ...parts: RegExp[]) => StringValidator<Values, Field>;
  matchSomeOf: (message?: string, ...orRegexps: RegExp[]) => StringValidator<Values, Field>;
  notMatchSomeOf: (message?: string, ...orRegexps: RegExp[]) => StringValidator<Values, Field>;
  max: (len: number, message?: string) => StringValidator<Values, Field>;
  min: (len: number, message?: string) => StringValidator<Values, Field>;
}

export function string<Values extends Record<string, any>, Field extends keyof Values>(message?: string): StringValidator<Values, Field> {
  const others: FieldFunctionValidator<Values, Field>[] = [];
  const validator: StringValidator<Values, Field> = (value, error, values, errors, trigger) => {
    if (value === undefined || value === null || typeof value !== 'string') {
      throw message || 'Must be string';
    }
    for (const other of others) {
      other(value, error, values, errors, trigger);
    }
  };
  validator.required = (message) => {
    others.push(required(message));
    return validator;
  };
  validator.trimmed = (message) => {
    others.push(trimmed(message));
    return validator;
  };
  validator.sameWith = (field, message) => {
    others.push(sameWith(field, message));
    return validator;
  };
  validator.sameWithWhenExists = (field, message) => {
    others.push(sameWithWhenExists(field, message));
    return validator;
  };
  validator.isEmail = (message) => {
    others.push(isEmail(message));
    return validator;
  };
  validator.composedOf = (message, ...parts) => {
    others.push(composedOf(message, ...parts));
    return validator;
  };
  validator.matchSomeOf = (message, ...orRegexps) => {
    others.push(matchSomeOf(message, ...orRegexps));
    return validator;
  };
  validator.notMatchSomeOf = (message, ...orRegexps) => {
    others.push(notMatchSomeOf(message, ...orRegexps));
    return validator;
  };
  validator.max = (len, message) => {
    others.push(max(len, message));
    return validator;
  };
  validator.min = (len, message) => {
    others.push(min(len, message));
    return validator;
  };
  return validator;
}

type NumberValidator<Values extends Record<string, any>, Field extends keyof Values> = FieldFunctionValidator<Values, Field> & {
  required: (message?: string) => NumberValidator<Values, Field>;
  max: (num: number, message?: string) => NumberValidator<Values, Field>;
  min: (num: number, message?: string) => NumberValidator<Values, Field>;
  integer: (message?: string) => NumberValidator<Values, Field>;
  notNan: (message?: string) => NumberValidator<Values, Field>;
}

type OptionNumber = number | null | undefined;

export function requiredNum(message = 'Required') {
  return (value: OptionNumber): void => {
    if (typeof value !== 'number') {
      throw message;
    }
  }
}

export function maxNum(num: number, message?: string) {
  return (value: OptionNumber): void => {
    if (typeof value === 'number' && value > num) {
      throw message || `Should be less or equal than ${num}`;
    }
  }
}

export function minNum(num: number, message?: string) {
  return (value: OptionNumber): void => {
    if (typeof value === 'number'  && value < num) {
      throw message || `Should be greater or equal than ${num}`;
    }
  }
}

export function integer(message = 'Should be a integer') {
  return (value: OptionNumber): void => {
    if (typeof value === 'number'  && !Number.isSafeInteger(value)) {
      throw message;
    }
  }
}

export function notNan(message = 'Should not be Nan') {
  return (value: OptionNumber): void => {
    if (typeof value === 'number'  && Number.isNaN(value)) {
      throw message;
    }
  }
}

export function number<Values extends Record<string, any>, Field extends keyof Values>(message: string): NumberValidator<Values, Field> {
  const others: FieldFunctionValidator<Values, Field>[] = [];
  const validator: NumberValidator<Values, Field> = (value, error, values, errors, trigger) => {
    if (value === undefined || value === null || typeof value !== 'number') {
      throw message;
    }
    for (const other of others) {
      other(value, error, values, errors, trigger);
    }
  };
  validator.required = (message) => {
    others.push(requiredNum(message));
    return validator;
  };
  validator.max = (num, message) => {
    others.push(maxNum(num, message));
    return validator;
  };
  validator.min = (num, message) => {
    others.push(minNum(num, message));
    return validator;
  };
  validator.integer = (message) => {
    others.push(integer(message));
    return validator;
  }
  validator.notNan = (message) => {
    others.push(notNan(message));
    return validator;
  }
  return validator;
}
