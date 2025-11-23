import React from 'react';
import PhoneHandsetIcon from './call';

const ROTATE_STYLE = { display: 'inline-block', transform: 'rotate(135deg)', marginTop: '5px' };

const PhoneHandsetHangupIcon: React.FC<{ size?: number, color?: string, className?: string }> = (props) => (
  <span style={ROTATE_STYLE} className={props.className}>
    <PhoneHandsetIcon {...props} />
  </span>
);

export default PhoneHandsetHangupIcon;
