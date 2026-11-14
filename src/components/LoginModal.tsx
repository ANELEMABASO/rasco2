import React from 'react';
import { StaffLoginView } from './StaffLoginView.tsx';
import { UserRole } from '../types.ts';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultTab?: UserRole;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <StaffLoginView
      isOpenModal={true}
      onClose={onClose}
      onSuccess={onClose}
    />
  );
};
