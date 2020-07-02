import * as React from 'react';
import { Errors, FieldValidateError, useForm } from '../src';

export default { title: 'useForm' };

const sleep = async (time: number) => new Promise(resolve => setTimeout(resolve, time));

export const Demo = () => {
  const [checkingName, setCheckingName] = React.useState(false);
  const [checkingEmail, setCheckingEmail] = React.useState(false);
  const { errors, values, handleChanges, handleBlurs, handleSubmit } = useForm({
    initialValues: {
      userName: '',
      email: '',
      password: '',
      conformedPassword: '',
    },
    validate: async (values, meta) => {
      const errors: Errors<typeof values> = {};
      if (meta.userName.change || meta.userName.blur) {
        if (!values.userName) {
          throw new FieldValidateError('userName', '用户名是必须的');
        }
        if (meta.userName.blur) {
          setCheckingName(true);
          await sleep(1000);
          setCheckingName(false);
          if (values.userName !== 'vipcxj') {
            throw new FieldValidateError('userName', '用户名已被使用');
          }
        }
      }
      if (meta.email.change || meta.email.blur) {
        if (!values.email) {
          throw new FieldValidateError('email', '电子邮箱是必须的');
        }
        if (meta.email.blur) {
          setCheckingEmail(true);
          await sleep(1000);
          setCheckingEmail(false);
          if (values.email !== 'vipcxj@form.com') {
            throw new FieldValidateError('email', '电子邮箱已被使用');
          }
        }
      }
      if (meta.password.change) {
        if (!values.password) {
          throw new FieldValidateError('password', '密码是必须的');
        }
      }
      if (meta.conformedPassword.change) {
        if (!values.conformedPassword) {
          throw new FieldValidateError('conformedPassword', '必须重复一遍密码');
        }
        if (values.conformedPassword !== values.password) {
          throw new FieldValidateError('conformedPassword', '与第一次输入的密码不同');
        }
      }
      return errors;
    },
    onSubmit: async () => {
      await sleep(3000);
      alert('提交成功');
    },
  });
  return (
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="userName">用户名</label>
          <input key="userName" value={values.userName} onChange={handleChanges.userName} onBlur={handleBlurs.userName} />
          { checkingName ? 'Checking...' : '' }
          { errors.userName }
        </div>
        <div>
          <label htmlFor="email">电子邮箱</label>
          <input key="email" value={values.email} onChange={evt => handleChanges.email(evt.target.value)} onBlur={handleBlurs.email} />
          { checkingEmail ? 'Checking...' : '' }
          { errors.email }
        </div>
        <div>
          <label htmlFor="password">密码</label>
          <input key="password" type="password" value={values.password} onChange={evt => handleChanges.password(evt.target.value)} onBlur={handleBlurs.password} />
          { errors.password }
        </div>
        <div>
          <label htmlFor="conformedPassword">重复密码</label>
          <input key="conformedPassword" type="password" value={values.conformedPassword} onChange={evt => handleChanges.conformedPassword(evt.target.value)} onBlur={handleBlurs.conformedPassword} />
          { errors.conformedPassword }
        </div>
        <button type="submit">Submit</button>
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
