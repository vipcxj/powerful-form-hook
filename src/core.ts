import React from 'react';

export type Meta<Values extends Record<string, any>> = {
    [K in keyof Values]: {
        change: boolean;
        blur: boolean;
    };
}

export type ErrorType = string | typeof Error_False | typeof Error_Keep | typeof Error_Reset;

export type ErrorsResult<Values extends Record<string, any>> = {
    [K in keyof Values]: ErrorType;
}

export class FieldValidateError extends Error {
    constructor(public field: string, message?: string) {
        // 'Error' breaks prototype chain here
        super(message);
        // restore prototype chain
        const actualProto = new.target.prototype;

        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(this, actualProto);
        } else {
            (this as any).__proto__ = actualProto;
        }
    }
}

export interface UseFormConfig<Values extends Record<string, any>> {
    initialValues: Values;
    validate: (values: Values, errors: ErrorsState<Values>, meta: Meta<Values>, submit: boolean) => ErrorsResult<Values> | Promise<ErrorsResult<Values>>;
    onSubmit: (values: Values) => void | Promise<void>;
}

export type ValidateFunction<Values extends Record<string, any>> = UseFormConfig<Values>['validate'];
export type OnSubmitFunction<Values extends Record<string, any>> = UseFormConfig<Values>['onSubmit'];

function mapValues<Values extends Record<string, any>>(
    values: Values,
    transformer: (key: keyof Values, value: Values[typeof key]) => any,
    filter?: (key: keyof Values, value: Values[typeof key]) => boolean,
): Record<keyof Values, any> {
    const result = {} as Record<keyof Values, any>;
    for (const key of Object.keys(values)) {
        if (!filter || filter(key, values[key])) {
            result[key as keyof Values] = transformer(key, values[key]);
        }
    }
    return result;
}

type ErrorState = {
    error: boolean | undefined;
    message?: string;
    version: number;
};

type ErrorsState<Values extends Record<string, any>> = {
    [K in keyof Values]: ErrorState;
}

let VERSION = 0;

export const Error_False = false;
export const Error_Keep = { keep: true };
export const Error_Reset = { reset: true };

function mergeError<Values extends Record<string, any>>(states: ErrorsState<Values>, errors: ErrorsResult<Values>, version: number): ErrorsState<Values> {
    let change = false;
    const newStates = {...states};
    for (const key of Object.keys(states)) {
        const newState = newStates[key];
        if (version >= newState.version) {
            const error = errors[key];
            if (error === Error_Reset) {
                newStates[key as keyof Values] = {
                    error: undefined,
                    message: undefined,
                    version,
                };
                change = true;
            } else if (error === Error_False) {
                newStates[key as keyof Values] = {
                    error: false,
                    message: undefined,
                    version,
                };
                change = true;
            } else if (typeof error === 'string') {
                newStates[key as keyof Values] = {
                    error: true,
                    message: error,
                    version,
                };
                change = true;
            }
        }
    }
    return change ? newStates : states;
}

function hasError<Values extends Record<string, any>>(
  errors: ErrorsState<Values>,
  errorsPatch: ErrorsResult<Values> | null, globalError: string | undefined | null,
  version: number,
) {
    const newErrors = errorsPatch ? mergeError(errors, errorsPatch, version) : {};
    return Object.keys(newErrors).some(key => newErrors[key].error) || typeof globalError === 'string';
}

export interface HandleChange {
    (value: any): void;
    checked: (value: any) => void;
}

export type FieldFunctionValidator<Values extends Record<string, any>, Field extends keyof Values> = (
  value: Values[Field],
  error: ErrorsState<Values>[Field],
  values: Values,
  errors: ErrorsState<Values>,
  trigger: Trigger,
) => void | Promise<void>;

export type TriggerSimpleOption = 'change' | 'blur' | 'blur!' | 'submit' | 'submit!';
export type TriggerObjectOption = {
    trigger: TriggerSimpleOption;
    fields?: string[];
};
export type TriggerOption = TriggerSimpleOption | TriggerObjectOption;
export type TriggersOption = TriggerOption | TriggerOption[];
function isTriggerSimpleOption(option: TriggersOption): option is TriggerSimpleOption {
    return typeof option === 'string';
}
function isTriggerObjectOption(option: TriggersOption): option is TriggerObjectOption {
    return !Array.isArray(option) && !isTriggerSimpleOption(option);
}
export const DEFAULT_TRIGGER_OPTIONS: TriggerSimpleOption[] = ['change', 'blur'];
type Trigger = 'change' | 'blur' | 'submit';

export type FieldObjectValidator<Values extends Record<string, any>, Field extends keyof Values> = {
    triggers: TriggerOption | Array<TriggerOption>;
    validate: FieldFunctionValidator<Values, Field>;
};

export type FieldArrayValidator<Values extends Record<string, any>, Field extends keyof Values> = Array<FieldFunctionValidator<Values, Field> | FieldObjectValidator<Values, Field>>;

export type FieldValidators<Values extends Record<string, any>> = {
    [field in keyof Values]?: FieldFunctionValidator<Values, field> | FieldObjectValidator<Values, field> | Array<FieldFunctionValidator<Values, field> | FieldObjectValidator<Values, field>>;
}

function extractTrigger<Values extends Record<string, any>>(field: keyof Values, meta: Meta<Values>, submit: boolean): Trigger | null {
    const m = meta[field];
    if (m.change) return 'change';
    if (m.blur) return 'blur';
    if (submit) return 'submit';
    return null;
}

export function isFunctionValidator<Values extends Record<string, any>, Field extends keyof Values>(
  processor: FieldValidators<Values>[Field]
): processor is FieldFunctionValidator<Values, Field> {
    return processor && !Array.isArray(processor) && typeof processor === 'function';
}

export function isObjectValidator<Values extends Record<string, any>, Field extends keyof Values>(
  processor: FieldValidators<Values>[Field]
): processor is FieldObjectValidator<Values, Field> {
    return processor && !Array.isArray(processor) && typeof processor !== 'function';
}

export function isArrayValidator<Values extends Record<string, any>, Field extends keyof Values>(
  processor: FieldValidators<Values>[Field]
): processor is FieldArrayValidator<Values, Field> {
    return processor && Array.isArray(processor);
}

enum TriggerMatch {
    FullMatch,
    OptionMatch,
    NotMatch,
}

function checkTriggers(triggers: TriggerOption | Array<TriggerOption>, trigger: Trigger, ownerField: string, triggerField: string, extraTriggers?: TriggerOption | Array<TriggerOption>): TriggerMatch {
    if (isTriggerSimpleOption(triggers)) {
        if (trigger === triggers && ownerField === triggerField) return trigger === 'change' ? TriggerMatch.FullMatch : TriggerMatch.OptionMatch;
        if (trigger + '!' === triggers && ownerField === triggerField) return TriggerMatch.FullMatch;
    } else if (isTriggerObjectOption(triggers)) {
        const { trigger: triggerOpt, fields = [] } = triggers;
        if (trigger === triggerOpt && (ownerField === triggerField || fields.indexOf(triggerField) !== -1)) return trigger === 'change' ? TriggerMatch.FullMatch : TriggerMatch.OptionMatch;
        if (trigger + '!' === triggerOpt && (ownerField === triggerField || fields.indexOf(triggerField) !== -1)) return TriggerMatch.FullMatch;
    } else {
        let optionMatch = false;
        for (const triggerOpt of triggers) {
            const match = checkTriggers(triggerOpt, trigger, ownerField, triggerField, extraTriggers);
            if (match === TriggerMatch.FullMatch) {
                return match;
            }
            if (match === TriggerMatch.OptionMatch) {
                optionMatch = true;
            }
        }
        return optionMatch ? TriggerMatch.OptionMatch : TriggerMatch.NotMatch;
    }
    if (extraTriggers) {
        return checkTriggers(extraTriggers, trigger, ownerField, triggerField);
    } else {
        return TriggerMatch.NotMatch;
    }
}

async function processFieldValidator<Values extends Record<string, any>, Field extends keyof Values>(
  errorsOut: ErrorsResult<Values>,
  values: Values, errors: ErrorsState<Values>,
  processor: FieldValidators<Values>[Field],
  processorField: Field,
  trigger: Trigger,
  triggerField: Field,
) {
    if (isFunctionValidator(processor) || isObjectValidator(processor)) {
        let triggers: TriggersOption;
        let validate: FieldFunctionValidator<Values, Field>;
        if (isFunctionValidator(processor)) {
            triggers = DEFAULT_TRIGGER_OPTIONS;
            validate = processor;
        } else {
            triggers = processor.triggers;
            validate = processor.validate;
        }
        const match = checkTriggers(triggers, trigger, processorField as string, triggerField as string, 'submit');
        if (match === TriggerMatch.NotMatch) {
            return;
        }
        if (match === TriggerMatch.FullMatch || errors[processorField].error === undefined) {
            await validate(values[processorField], errors[processorField], values, errors, trigger);
            if (errorsOut[processorField] !== Error_Reset) {
                errorsOut[processorField] = trigger === 'change' ? Error_Reset : Error_False;
            }
        }
    } else if (isArrayValidator(processor)) {
        for (const subProcessor of processor) {
            await processFieldValidator(errorsOut, values, errors, subProcessor, processorField, trigger, triggerField);
        }
    }
}

export function createValidator<Values extends Record<string, any>>(processors: FieldValidators<Values>): ValidateFunction<Values> {
    return async (values: Values, errors: ErrorsState<Values>, meta: Meta<Values>, submit: boolean) => {
        const errorsOut: ErrorsResult<Values> = createKeepErrors(errors);
        const fields: Array<keyof Values> = Object.keys(processors);
        for (const field of fields) {
            if (meta[field].change || meta[field].blur || submit) {
                const trigger = extractTrigger(field, meta, submit)!;
                const tasks = fields.map(async (processorField) => {
                    try {
                        const processor = processors[processorField];
                        await processFieldValidator(errorsOut, values, errors, processor, processorField, trigger, field);
                    } catch (e) {
                        if (e instanceof FieldValidateError) {
                            errorsOut[e.field as keyof Values] = typeof e === 'string' ? e : `${e.message || ''}`;
                        } else {
                            errorsOut[processorField] = typeof e === 'string' ? e : `${e.message || ''}`;
                        }
                    }
                })
                await Promise.all(tasks);
            }
        }
        return errorsOut;
    }
}

export function createKeepErrors<Values extends Record<string, any>>(errorsState: ErrorsState<Values>): ErrorsResult<Values> {
    return mapValues(errorsState, _ => Error_Keep);
}

export function createNoErrors<Values extends Record<string, any>>(errorsState: ErrorsState<Values>): ErrorsResult<Values> {
    return mapValues(errorsState, _ => Error_False);
}

export function createResetErrors<Values extends Record<string, any>>(errorsState: ErrorsState<Values>): ErrorsResult<Values> {
    return mapValues(errorsState, _ => Error_Reset);
}

export const useForm = <Values extends Record<string, any>> ({ initialValues, validate, onSubmit }: UseFormConfig<Values>) => {
    const [fixedInitialValues] = React.useState(initialValues);
    const [values, setValues] = React.useState(fixedInitialValues);
    const [errors, setErrors] = React.useState<ErrorsState<Values>>(() => mapValues(fixedInitialValues, _ => {
        const version = ++VERSION;
        return {
            error: undefined,
            message: undefined,
            version,
        }
    }));
    const [validatingState, setValidatingState] = React.useState<number[]>([]);
    const validating = validatingState.length > 0;
    const [submitting, setSubmitting] = React.useState(false);
    const unmountRef = React.useRef<boolean>(false);
    React.useEffect(() => {
        return () => {
            unmountRef.current = true;
        }
    }, []);
    const [globalErrors, setGlobalErrors] = React.useState<ErrorState>(() => ({
        error: undefined,
        message: undefined,
        version: ++VERSION,
    }));
    const setFieldError = React.useCallback((field: keyof Values, error?: string | null) => {
        setErrors(preErrors => ({
            ...preErrors,
            [field]: {
                error: error !== null && error !== undefined,
                message: error ?? undefined,
                version: ++VERSION,
            },
        }));
    }, []);
    const setGlobalError = React.useCallback((error?: string | null) => {
        setGlobalErrors({
            error: error !== null && error !== undefined,
            message: error ?? undefined,
            version: ++VERSION,
        });
    }, []);

    /**
     * the return value represent whether or not has error.
     * but it is only meaningful when using in submit.
     * because only the validation in submit is exclusive mode.
     */
    const execValidate = React.useCallback(async (values: Values, meta: Meta<Values>, submit: boolean) => {
        const version = ++VERSION;
        let errorsPatch: ErrorsResult<Values> | null = null;
        let globalError : string | undefined | null = null;
        try {
            setValidatingState(prevState => ([...prevState, version]));
            const errorsOut = await validate(values, errors, meta, submit);
            if (!unmountRef.current) {
                setErrors(preErrors => {
                    return mergeError(preErrors, errorsOut, version);
                });
            }
            errorsPatch = errorsOut;
        } catch (e) {
            if (!unmountRef.current) {
                if (e instanceof FieldValidateError) {
                    const errorsOut = createKeepErrors(errors);
                    errorsOut[(e.field) as keyof Values] = `${e.message || ''}`;
                    setErrors(preErrors => {
                        return mergeError(preErrors, errorsOut, version);
                    });
                    errorsPatch = errorsOut;
                } else {
                    const uncatchedError = typeof e === 'string' ? e : (`${e.message}` || '');
                    const fields = Object.keys(meta).filter(key => meta[key].change || meta[key].blur);
                    if (fields.length > 0) {
                        const errorsOut = errorsPatch = createKeepErrors(errors);
                        for (const field of fields) {
                            errorsPatch[field as keyof Values] = uncatchedError;
                        }
                        setErrors(preErrors => {
                            return mergeError(preErrors, errorsOut, version);
                        });
                        errorsPatch = errorsOut;
                    } else {
                        globalError = uncatchedError;
                        const error: ErrorState = {
                            error: true,
                            message: globalError,
                            version,
                        }
                        setGlobalErrors(prevError => {
                            if (version >= prevError.version) {
                                return error;
                            } else {
                                return prevError;
                            }
                        });
                    }
                }
            }
        } finally {
            setValidatingState(prevState => {
                const index = prevState.indexOf(version);
                if (index >= 0) {
                    const newState = [...prevState];
                    newState.splice(index, 1);
                    return newState;
                } else {
                    return prevState;
                }
            });
        }
        return [errorsPatch, globalError, version] as const;
    }, [setValidatingState, validate, errors, setErrors, setGlobalErrors]);
    const handleChanges: Record<keyof Values, HandleChange> = React.useMemo(() => mapValues(
      fixedInitialValues,
        key => {
            const meta = mapValues(fixedInitialValues, k => ({ change: k === key, blur: false }));
            const handleChange = (value: any): void => {
                if (submitting) return;
                let target = value;
                if (value instanceof Event || value.originalEvent instanceof Event || value.nativeEvent instanceof Event) {
                    target = value.target.value;
                }
                setValues(preValues => {
                    const newValues = { ...preValues, [key]: target };
                    // noinspection JSIgnoredPromiseFromCall
                    execValidate(newValues, meta, false);
                    return newValues;
                });
            }
            handleChange.checked = (value: any): void => {
                let target = value;
                if (value instanceof Event || value.originalEvent instanceof Event || value.nativeEvent instanceof Event) {
                    target = value.target.checked;
                }
                handleChange(target);
            }
            return handleChange;
        },
    ), [submitting, execValidate]);
    const handleBlurs: Record<keyof Values, () => void> = React.useMemo(() => mapValues(
      fixedInitialValues,
        key => {
            const meta = mapValues(fixedInitialValues, k => ({ change: false, blur: k === key }));
            return (evt: React.SyntheticEvent) => {
                if (submitting) return;
                evt.preventDefault();
                // noinspection JSIgnoredPromiseFromCall
                execValidate(values, meta, false);
            };
        },
    ), [submitting, values, execValidate]);
    const handleSubmit = React.useCallback(async (evt?: React.SyntheticEvent) => {
        evt && evt.preventDefault && evt.preventDefault();
        if (validating || submitting) return;
        setSubmitting(true);
        try {
            const meta = mapValues(fixedInitialValues, _ => ({ change: false, blur: false }));
            const [errorsPatch, newGlobalError, version] = await execValidate(values, meta, true);
            if (!hasError(errors, errorsPatch, newGlobalError, version) && !unmountRef.current) {
                await onSubmit(values);
            }
        } finally {
            setSubmitting(false);
        }
    }, [validating, submitting, setSubmitting, execValidate, values, onSubmit]);
    return {
        values,
        errors,
        globalError: globalErrors,
        setFieldError,
        setGlobalError,
        handleChanges,
        handleBlurs,
        handleSubmit,
        submitting,
        validating,
    }
};
