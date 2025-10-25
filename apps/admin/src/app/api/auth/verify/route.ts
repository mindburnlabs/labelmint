import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Mock user database
const users = [
  {
    id: '1',
    email: 'admin@labelmint.com',
    role: 'admin',
    permissions: ['dashboard', 'users', 'projects', 'finance', 'disputes', 'analytics', 'settings', '*'],
    profile: {
      firstName: 'Admin',
      lastName: 'User',
      avatar: null
    }
  },
  {
    id: '2',
    email: 'demo@labelmint.com',
    role: 'manager',
    permissions: ['dashboard', 'users', 'projects', 'analytics'],
    profile: {
      firstName: 'Demo',
      lastName: 'User',
      avatar: null
    }
  }
];

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('admin_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: 'No access token found' },
        { status: 401 }
      );
    }

    // Extract user ID from token (mock implementation)
    const userIdMatch = accessToken.match(/mock_access_token_(\d+)_/);
    if (!userIdMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid token format' },
        { status: 401 }
      );
    }

    const userId = userIdMatch[1];
    const user = users.find(u => u.id === userId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}