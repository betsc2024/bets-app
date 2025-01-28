import React from 'react';
import UserDashboard from '../components/user/UserDashboard';

const UserDashboardPage = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      {/* Analytics Cards */}
      <UserDashboard />
    </div>
  );
};

export default UserDashboardPage;
