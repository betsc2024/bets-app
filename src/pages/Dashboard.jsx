import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Database, Users2, ClipboardList, Plus, ArrowRight, Building, Settings } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Get user role and name
  const userRole = user?.user_metadata?.role;
  const isAdmin = user?.user_metadata?.is_super_admin || userRole === 'super_admin';
  console.log('User Metadata:', user?.user_metadata); // Debug log
  console.log('User Role:', userRole); // Debug log
  console.log('Is Admin:', isAdmin); // Debug log
  
  const userName = isAdmin
    ? 'Super Admin'
    : user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  
  const overviewCards = [
    {
      title: "Attribute Bank",
      description: "Manage and organize attributes",
      icon: Database,
      value: "24 Attributes",
      link: "/attribute-bank",
      color: "text-violet-500"
    },
    {
      title: "Industry Management",
      description: "Configure industry settings",
      icon: Building2,
      value: "8 Industries",
      link: "/industry",
      color: "text-blue-500"
    },
    {
      title: "User Management",
      description: "Manage user access and roles",
      icon: Users2,
      value: "12 Users",
      link: "/users",
      color: "text-green-500"
    },
    {
      title: "Evaluations",
      description: "Track and review evaluations",
      icon: ClipboardList,
      value: "6 Active",
      link: "/evaluations",
      color: "text-orange-500"
    }
  ];

  const quickActions = [
    {
      title: "Add New Industry",
      description: "Configure a new industry sector",
      icon: Building2,
      link: "/industry"
    },
    {
      title: "Add New Attribute",
      description: "Create and configure attributes",
      icon: Settings,
      link: "/attribute-management"
    },
    {
      title: "Add New Company",
      description: "Add and setup a new company",
      icon: Building,
      link: "/company-management"
    },
    {
      title: "Add New Attribute Bank",
      description: "Create new attribute bank entry",
      icon: Database,
      link: "/attribute-bank"
    }
  ];

  return (
    <div className="p-6 space-y-8 max-w-full">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          Hello, {userName}
        </h1>
      </div>

      <h1 className="text-3xl font-bold text-primary mb-4">Dashboard</h1>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {overviewCards.map((card, index) => (
          <Card 
            key={index} 
            className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer"
            onClick={() => navigate(card.link)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => (
            <Card 
              key={index}
              className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer group"
              onClick={() => navigate(action.link)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    <action.icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-medium">{action.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                  <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
