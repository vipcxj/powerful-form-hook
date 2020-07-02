import * as React from 'react';
import { Errors, FieldValidateError, useForm, ValidateFunction, OnSubmitFunction } from '../src';

export default { title: 'useForm' };

const sleep = async (time: number) => new Promise(resolve => setTimeout(resolve, time));

enum CheckingStatus {
  Unchecked,
  Checking,
  Valid,
  Invalid,
}

function printCheckingStatus(status: CheckingStatus) {
  switch (status) {
    case CheckingStatus.Checking:
      return 'Checking...';
    case CheckingStatus.Invalid:
      return 'Invalid!';
    case CheckingStatus.Valid:
      return 'Valid';
    case CheckingStatus.Unchecked:
      return null;
  }
}

export const Demo = () => {
  const [nameStatus, setNameStatus] = React.useState(CheckingStatus.Unchecked);
  const [emailStatus, setEmailStatus] = React.useState(CheckingStatus.Unchecked);
  const initialValue = {
    userName: '',
    email: '',
    password: '',
    conformedPassword: '',
  };
  const validate: ValidateFunction<typeof initialValue> = React.useCallback(async (values, meta, submit) => {
    const errors: Errors<typeof values> = {};
    if (meta.userName.change || meta.userName.blur || submit) {
      if (meta.userName.change) {
        setNameStatus(CheckingStatus.Unchecked);
      }
      if (!values.userName) {
        throw new FieldValidateError('userName', '用户名是必须的');
      }
      if (nameStatus === CheckingStatus.Unchecked && (meta.userName.blur || submit)) {
        setNameStatus(CheckingStatus.Checking);
        await sleep(1000);
        if (values.userName !== 'vipcxj') {
          setNameStatus(CheckingStatus.Invalid);
          throw new FieldValidateError('userName', '用户名已被使用');
        }
        setNameStatus(CheckingStatus.Valid);
      }
    }
    if (meta.email.change || meta.email.blur || submit) {
      if (meta.email.change) {
        setEmailStatus(CheckingStatus.Unchecked);
      }
      if (!values.email) {
        throw new FieldValidateError('email', '电子邮箱是必须的');
      }
      if (emailStatus === CheckingStatus.Unchecked && (meta.email.blur || submit)) {
        setEmailStatus(CheckingStatus.Checking);
        await sleep(3000);
        if (values.email !== 'vipcxj@form.com') {
          setEmailStatus(CheckingStatus.Invalid);
          throw new FieldValidateError('email', '电子邮箱已被使用');
        }
        setEmailStatus(CheckingStatus.Valid);
      }
    }
    if (meta.password.change || meta.password.blur || submit) {
      if (!values.password) {
        throw new FieldValidateError('password', '密码是必须的');
      }
    }
    if (meta.conformedPassword.change || meta.password.blur || submit) {
      if (!values.conformedPassword) {
        throw new FieldValidateError('conformedPassword', '必须重复一遍密码');
      }
      if (values.conformedPassword !== values.password) {
        throw new FieldValidateError('conformedPassword', '与第一次输入的密码不同');
      }
    }
    return errors;
  }, [nameStatus, emailStatus]);
  const onSubmit: OnSubmitFunction<typeof initialValue> = React.useCallback(async () => {
    await sleep(2500);
    alert('提交成功');
  }, []);
  const { errors, values, handleChanges, handleBlurs, handleSubmit, submitting, validating } = useForm({
    initialValues: {
      userName: '',
      email: '',
      password: '',
      conformedPassword: '',
    },
    validate,
    onSubmit,
  });
  return (
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="userName">用户名</label>
          <input key="userName" value={values.userName} onChange={handleChanges.userName} onBlur={handleBlurs.userName} />
          { printCheckingStatus(nameStatus) }
          { errors.userName.message || null }
        </div>
        <div>
          <label htmlFor="email">电子邮箱</label>
          <input key="email" value={values.email} onChange={evt => handleChanges.email(evt.target.value)} onBlur={handleBlurs.email} />
          { printCheckingStatus(emailStatus) }
          { errors.email.message || null }
        </div>
        <div>
          <label htmlFor="password">密码</label>
          <input key="password" type="password" value={values.password} onChange={evt => handleChanges.password(evt.target.value)} onBlur={handleBlurs.password} />
          { errors.password.message || null }
        </div>
        <div>
          <label htmlFor="conformedPassword">重复密码</label>
          <input key="conformedPassword" type="password" value={values.conformedPassword} onChange={evt => handleChanges.conformedPassword(evt.target.value)} onBlur={handleBlurs.conformedPassword} />
          { errors.conformedPassword.message || null }
        </div>
        <button type="submit">Submit</button>
        { submitting ? 'Submitting...' : validating ? 'Validating...' : null }
      </form>
  );
};

export const StrictMode = () => {
  return (
      <React.StrictMode>
        <Demo/>
      </React.StrictMode>
  );
};
