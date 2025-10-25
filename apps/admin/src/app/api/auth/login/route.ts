import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Mock user database
const users = [
  {
    id: '1',
    email: 'admin@labelmint.com',
    password: 'admin123',
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
    password: 'demo123',
    role: 'manager',
    permissions: ['dashboard', 'users', 'projects', 'analytics'],
    profile: {
      firstName: 'Demo',
      lastName: 'User',
      avatar: null
    }
  }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Find user by email
    const user = users.find(u => u.email === email);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check password
    if (user.password !== password) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate mock tokens
    const accessToken = `mock_access_token_${user.id}_${Date.now()}`;
    const refreshToken = `mock_refresh_token_${user.id}_${Date.now()}`;

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set('admin_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/'
    });

    cookieStore.set('admin_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    });

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}