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
        super(message);
    }
}

interface UseFormConfig<Values extends Record<string, any>> {
    initialValues: Values;
    validate: (values, meta: Meta<Values>) => Errors<Values> | Promise<Errors<Values>>;
    onSubmit: (values: Values) => void | Promise<void>;
}

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

export const useForm = <Values extends Record<string, any>> ({ initialValues, validate, onSubmit }: UseFormConfig<Values>) => {
    const [values, setValues] = React.useState(initialValues);
    const [errors, setErrors] = React.useState<Errors<Values>>({});
    const unmountRef = React.useRef<boolean>(false);
    React.useEffect(() => {
        return () => {
            unmountRef.current = true;
        }
    }, []);
    const [globalError, setGlobalError] = React.useState<string | undefined>();
    const setFieldError = React.useCallback((field: keyof Values, error?: string) => {
        setErrors(preErrors => ({ ...preErrors, [field]: error }));
    }, []);
    const execValidate = React.useCallback(async (values: Values, meta: Meta<Values>) => {
        let error = false;
        try {
            const errorsPatch = await validate(values, meta);
            if (!unmountRef.current) {
                error = Object.keys(errorsPatch).length > 0;
                setErrors(preErrors => ({
                    ...preErrors,
                    ...mapValues(meta, _ => undefined, (_, m) => m.change ),
                    ...errorsPatch,
                }));
            }
        } catch (e) {
            if (!unmountRef.current) {
                if (e instanceof FieldValidateError) {
                    error = true;
                    setErrors(preErrors => ({
                        ...preErrors,
                        ...mapValues(meta, _ => undefined, (_, m) => m.change ),
                        [(e as FieldValidateError).field]: e.message,
                    }));
                } else if ('message' in e) {
                    error = !!e.message;
                    setGlobalError(e.message);
                }
            }
        }
        return error;
    }, [validate]);
    const handleChanges = React.useMemo(() => mapValues(
        initialValues,
        key => {
            const meta = mapValues(initialValues, k => ({ change: k === key, blur: false }));
            return value => {
                let target = value;
                if (value instanceof Event || value.originalEvent instanceof Event || value.nativeEvent instanceof Event) {
                    target = value.target.value;
                }
                setValues(preValues => {
                    const newValues = { ...preValues, [key]: target };
                    // noinspection JSIgnoredPromiseFromCall
                    execValidate(newValues, meta);
                    return newValues;
                });
            }
        },
    ), [execValidate]);
    const handleBlurs = React.useMemo(() => mapValues(
        initialValues,
        key => {
            const meta = mapValues(initialValues, k => ({ change: false, blur: k === key }));
            return () => {
                // noinspection JSIgnoredPromiseFromCall
                execValidate(values, meta);
            };
        },
    ), [values, execValidate]);
    const handleSubmit: React.FormEventHandler = React.useCallback(async (evt) => {
        evt.preventDefault();
        const meta = mapValues(initialValues, _ => ({ change: true, blur: false}));
        const error = await execValidate(values, meta);
        if (!error) {
            await onSubmit(values);
        }
    }, [execValidate, values]);
    return {
        values,
        errors,
        globalError,
        setGlobalError,
        setFieldError,
        handleChanges,
        handleBlurs,
        handleSubmit,
    }
};
