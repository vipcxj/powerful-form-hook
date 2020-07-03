import React from 'react';

type Meta<Values extends Record<string, any>> = {
    [K in keyof Values]: {
        change: boolean;
        blur: boolean;
    };
}

export type Errors<Values extends Record<string, any>> = {
    [K in keyof Values]?: undefined | string;
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

interface UseFormConfig<Values extends Record<string, any>> {
    initialValues: Values;
    validate: (values: Values, meta: Meta<Values>, submit: boolean) => Errors<Values> | Promise<Errors<Values>>;
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
    error?: boolean;
    message?: string;
    version: number;
};

type ErrorsState<Values extends Record<string, any>> = {
    [K in keyof Values]: ErrorState;
}

let VERSION = 0;

function mergeError<Values extends Record<string, any>>(states: ErrorsState<Values>, errors: Errors<Values>, meta: Meta<Values>, version: number): ErrorsState<Values> {
    let change = false;
    const newStates = {...states};
    for (const key of Object.keys(states)) {
        const newState = newStates[key];
        if (version >= newState.version) {
            if (key in errors) {
                if ((errors[key] ?? undefined) === undefined) {
                    newStates[key as keyof Values] = {
                        error: false,
                        message: undefined,
                        version,
                    };
                    change = true;
                } else {
                    newStates[key as keyof Values] = {
                        error: true,
                        message: errors[key],
                        version,
                    };
                    change = true;
                }
            } else if (meta[key].change) {
                newStates[key as keyof Values] = {
                    error: false,
                    message: undefined,
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
  errorsPatch: Errors<Values>, globalError: string | undefined | null,
  meta: Meta<Values>, version: number,
) {
    const newErrors = mergeError(errors, errorsPatch, meta, version);
    return Object.keys(newErrors).some(key => newErrors[key].error) || typeof globalError === 'string';
}

interface HandleChange {
    (value: any): void;
    checked: (value: any) => void;
}

export const useForm = <Values extends Record<string, any>> ({ initialValues, validate, onSubmit }: UseFormConfig<Values>) => {
    const [values, setValues] = React.useState(initialValues);
    const [errors, setErrors] = React.useState<ErrorsState<Values>>(() => mapValues(initialValues, _ => {
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
        let errorsPatch: Errors<Values> = {};
        let globalErrorsPatch : string | undefined | null = undefined;
        try {
            setValidatingState(prevState => ([...prevState, version]));
            errorsPatch = await validate(values, meta, submit);
            if (!unmountRef.current) {
                setErrors(preErrors => {
                    return mergeError(preErrors, errorsPatch, meta, version);
                });
            }
        } catch (e) {
            if (!unmountRef.current) {
                if (e instanceof FieldValidateError) {
                    errorsPatch = {
                        [((e as FieldValidateError).field)]: `${e.message || ''}`,
                    } as Errors<Values>;
                    setErrors(preErrors => {
                        return mergeError(preErrors, errorsPatch, meta, version);
                    });
                } else {
                    globalErrorsPatch = typeof e === 'string' ? e : (e.message || '');
                    const error: ErrorState = {
                        error: true,
                        message: typeof e === 'string' ? e : (e.message || ''),
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
        return [errorsPatch, globalErrorsPatch, version] as const;
    }, [setValidatingState, validate, setErrors, setGlobalErrors]);
    const handleChanges: Record<keyof Values, HandleChange> = React.useMemo(() => mapValues(
        initialValues,
        key => {
            const meta = mapValues(initialValues, k => ({ change: k === key, blur: false }));
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
        initialValues,
        key => {
            const meta = mapValues(initialValues, k => ({ change: false, blur: k === key }));
            return () => {
                if (submitting) return;
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
            const meta = mapValues(initialValues, _ => ({ change: false, blur: false }));
            const [errorsPatch, newGlobalError, version] = await execValidate(values, meta, true);
            if (!hasError(errors, errorsPatch, newGlobalError, meta, version) && !unmountRef.current) {
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
