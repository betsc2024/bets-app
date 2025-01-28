import React from 'react';
import UserEvaluations from '../components/user/UserEvaluations';

const UserEvaluationsPage = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">My Evaluations</h1>
      <UserEvaluations />
    </div>
  );
};

export default UserEvaluationsPage;
