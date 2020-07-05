# powerful-form-hook &middot; ![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg) [![npm version](https://img.shields.io/npm/v/powerful-form-hook.svg?style=flat)](https://www.npmjs.com/package/powerful-form-hook)

A hook to help create form in React.

# key features

- No external state, only react hook
- No dependences, except tslib which is the runtime of typescript
- Write in typescript, so everything is typed.
- Powerful validate function. At least power than `Formik`.
 I developed this library precisely because formik's validation (with `yup`) didn't meet my needs.
 
## Installation
 
 Using [npm](https://www.npmjs.com/):
 
     $ npm install --save powerful-form-hook
     
## Demo

[storybook](https://vipcxj.github.io/powerful-form-hook/)

## Example
```typescript
import {
  Button,
  FormControlLabel, FormHelperText,
  Grid, InputAdornment,
  Switch,
  TextField} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import { createValidator, useForm, OnSubmitFunction, REG_SPECIAL, string, sameWithWhenExists } from 'powerful-form-hook';

const useStyles = makeStyles((theme) => ({
  root: {
    width: `calc(100% - ${theme.spacing(3) * 2}px)`, // Fix IE 11 issue.
    margin: theme.spacing(3),
    marginTop: theme.spacing(6),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
}));

const sleep = async (time: number) => new Promise(resolve => setTimeout(resolve, time));

enum CheckingStatus {
  Unchecked,
  Checking,
  Valid,
  Invalid,
}

function createCheckStatusAdornment(status: CheckingStatus) {
  switch (status) {
    case CheckingStatus.Unchecked:
      return {};
    case CheckingStatus.Checking:
      return {
        endAdornment: (
          <InputAdornment position="end">
            checking...
          </InputAdornment>
        ),
      };
    case CheckingStatus.Valid:
      return {
        endAdornment: (
          <InputAdornment position="end">
            valid
          </InputAdornment>
        ),
      };
    case CheckingStatus.Invalid:
      return {
        endAdornment: (
          <InputAdornment position="end">
            invalid
          </InputAdornment>
        ),
      };
  }
}

export const Demo = () => {
  const [nameStatus, setNameStatus] = React.useState(CheckingStatus.Unchecked);
  const nameAdornment = React.useMemo(() => createCheckStatusAdornment(nameStatus), [nameStatus]);
  const [emailStatus, setEmailStatus] = React.useState(CheckingStatus.Unchecked);
  const emailAdornment = React.useMemo(() => createCheckStatusAdornment(emailStatus), [emailStatus]);
  const initialValues = React.useMemo(() => ({
    userName: '',
    email: '',
    password: '',
    conformedPassword: '',
    agreement: false,
  }), []);
  const classes = useStyles();
  /** You can provider a validator function directly. The validator function accept the form values, errors, a meta object and submit variable.
   *  The meta object and the submit variable contains the infomation of why the validator function is triggered. Possible causes are 'change', 'blur' and 'submit'.
   *  'change' and 'blur' event are bind to the field.
   *  It's up to you whether the form is validated according to the trigger information.
   *  Here I provide a createValidator fuction to make life easier. With it, you can write the validate code for the separate field.
   *  The field validator support multi validator with separate triggers. The triggers can be bind to the other fields too.
   *  See the password field validator of the example. The blur of password and conformedPassword all trigger their validate tasks.
   *  The default triggers are ['change', 'blur']. it means when the field change or blur, the validator of this field will be triggered.
   *  For very very complicated situation, you may want to write you own validate logical. you can refer to my source code of createValidator.
   */
  const validate = React.useMemo(() => createValidator<typeof initialValues>({
    userName: [
	  // trigger by change or blur
      string().required('用户名是必须的').trimmed('两边不能有空格'),
	  // trigger by blur. it's a async custom validator. If validate fail, just throw a string message or a standary Error with message.
      {
        triggers: 'blur',
        validate: async (value) => {
          setNameStatus(CheckingStatus.Checking);
          await sleep(1000);
          if (value !== 'vipcxj') {
            setNameStatus(CheckingStatus.Invalid);
            throw '用户名已被使用';
          }
          setNameStatus(CheckingStatus.Valid);
        }
      },
    ],
	// same as userName.
    email: [
      string().required('电子邮箱是必须的').trimmed('两边不能有空格'),
      {
        triggers: 'blur',
        validate: async value => {
          setEmailStatus(CheckingStatus.Checking);
          await sleep(3000);
          if (value !== 'vipcxj@form.com') {
            setEmailStatus(CheckingStatus.Invalid);
            throw '电子邮箱已被使用';
          }
          setEmailStatus(CheckingStatus.Valid);
        }
      },
    ],
    password: [
      string()
        .required('密码是必须的')
        .composedOf('必须由大小写字母, 数字和键盘特殊符号组成', /[a-z]+/i, /\d+/, REG_SPECIAL)
        .matchSomeOf('密码必须包含大写字母或键盘特殊符号', /[A-Z]+/, REG_SPECIAL)
        .min(6, '密码长度必须大于等于6')
        .max(24, '密码长度必须小于等于24'),
	  // the validate task will trigger by blur of itself and conformedPassword field.
      {
        triggers: {
          trigger: 'blur',
          fields: ['conformedPassword'],
        },
        validate: sameWithWhenExists('conformedPassword', '两次输入的密码必须相同'),
      },
    ],
    conformedPassword: [
      string('必须是字符串'),
	  // the validate task will trigger by blur of itself and password field.
      {
        triggers: {
          trigger: 'blur',
          fields: ['password'],
        },
        validate: sameWithWhenExists('password', '两次输入的密码必须相同'),
      },
    ],
	// trigger by change or blur. it's a sync custom validator. If validate fail, just throw a string message or a standary Error with message.
    agreement: value => {
      if (!value) {
        throw new Error('必须同意网站条款');
      }
    },
  }), []);
  // Only when validate successful, the form submit. And if some validate task is running in the background or the form is submitting, the form will not be sumbited.
  const onSubmit: OnSubmitFunction<typeof initialValues> = React.useCallback(async (values: typeof initialValues) => {
    await sleep(2500);
    alert('提交成功');
  }, []);
  // handleChanges accept both event and value. For default, handleChanges will extract the value from event.target.value. For component like CheckBox which accept checked, use handleChanges[field].checked.
  const { errors, values, handleChanges, handleBlurs, handleSubmit, submitting, validating } = useForm({
    initialValues,
    validate,
    onSubmit,
  });
  return (
      <form className={classes.root} onSubmit={handleSubmit} noValidate>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              variant="outlined"
              fullWidth
              id="userName"
              name="userName"
              label="用户名"
              aria-label="用户名"
              autoComplete="userName"
              autoFocus
              value={values.userName}
              onChange={handleChanges.userName}
              onBlur={handleBlurs.userName}
              error={errors.userName.error}
              helperText={errors.userName.message}
              InputProps={nameAdornment}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              variant="outlined"
              fullWidth
              id="email"
              name="email"
              label="电子邮箱"
              aria-label="电子邮箱"
              autoComplete="email"
              type="email"
              value={values.email}
              onChange={handleChanges.email}
              onBlur={handleBlurs.email}
              error={errors.email.error}
              helperText={errors.email.message}
              InputProps={emailAdornment}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              variant="outlined"
              fullWidth
              id="password"
              label="密码"
              aria-label="密码"
              autoComplete="password"
              type="password"
              value={values.password}
              onChange={handleChanges.password}
              onBlur={handleBlurs.password}
              error={errors.password.error}
              helperText={errors.password.message}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              variant="outlined"
              fullWidth
              id="confirmPassword"
              label="重复密码"
              aria-label="密码"
              autoComplete="password"
              type="password"
              value={values.conformedPassword}
              onChange={handleChanges.conformedPassword}
              onBlur={handleBlurs.conformedPassword}
              error={errors.conformedPassword.error}
              helperText={errors.conformedPassword.message}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch />}
              label="是否同意网站服务条款"
              value={values.agreement}
              checked={values.agreement}
              onChange={handleChanges.agreement.checked}
              onBlur={handleBlurs.agreement}
            />
            <FormHelperText error={errors.agreement.error}>
              { errors.agreement.message }
            </FormHelperText>
          </Grid>
        </Grid>
        <Button className={classes.submit} type="submit" variant="contained" color="primary">Submit</Button>
        { submitting ? 'Submitting...' : validating ? 'Validating...' : null }
      </form>
  );
};
```

## User Guides

WIP