#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()

interface SeedConfig {
  organizations: number
  teamsPerOrg: number
  usersPerOrg: number
  projectsPerTeam: number
}

const DEFAULT_CONFIG: SeedConfig = {
  organizations: 5,
  teamsPerOrg: 3,
  usersPerOrg: 10,
  projectsPerTeam: 5
}

class MultiTenantSeeder {
  private config: SeedConfig
  private createdOrganizations: any[] = []
  private createdUsers: any[] = []

  constructor(config: Partial<SeedConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async seed(): Promise<void> {
    console.log('🌱 Starting multi-tenant seeding...')
    console.log(`Creating ${this.config.organizations} organizations with various teams and users`)

    try {
      // Clean existing data
      await this.cleanup()

      // Create organizations
      await this.createOrganizations()

      // Create users and assign to organizations
      await this.createUsers()

      // Create teams
      await this.createTeams()

      // Create projects
      await this.createProjects()

      // Create sample audit logs
      await this.createAuditLogs()

      console.log('\n✅ Multi-tenant seeding completed successfully!')
      this.printSummary()
    } catch (error) {
      console.error('❌ Seeding failed:', error)
      throw error
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up existing data...')

    // Delete in proper order to respect foreign key constraints
    await prisma.auditLog.deleteMany()
    await prisma.projectMember.deleteMany()
    await prisma.project.deleteMany()
    await prisma.teamMember.deleteMany()
    await prisma.team.deleteMany()
    await prisma.organizationMember.deleteMany()
    await prisma.organization.deleteMany()
    await prisma.user.deleteMany()

    console.log('✅ Cleanup completed')
  }

  private async createOrganizations(): Promise<void> {
    console.log('\n🏢 Creating organizations...')

    const plans = ['free', 'starter', 'pro', 'enterprise']
    const statuses = ['active', 'active', 'active', 'trial']

    for (let i = 0; i < this.config.organizations; i++) {
      const organization = await prisma.organization.create({
        data: {
          name: faker.company.name(),
          domain: faker.internet.domainName(),
          slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
          logo: faker.image.imageUrl(200, 200, 'business'),
          status: statuses[i % statuses.length] as any,
          settings: {
            timezone: faker.address.timeZone(),
            language: 'en',
            dateFormat: 'MM/DD/YYYY',
            currency: 'USD',
            notifications: {
              email: true,
              slack: false,
              webhook: false
            }
          },
          subscription: {
            plan: plans[i % plans.length],
            status: 'active',
            startDate: new Date(2024, 0, 1),
            endDate: new Date(2024, 11, 31),
            limits: {
              users: plans[i % plans.length] === 'free' ? 5 : plans[i % plans.length] === 'starter' ? 20 : 100,
              teams: plans[i % plans.length] === 'free' ? 2 : plans[i % plans.length] === 'starter' ? 5 : 20,
              projects: plans[i % plans.length] === 'free' ? 5 : plans[i % plans.length] === 'starter' ? 20 : 100,
              storage: plans[i % plans.length] === 'free' ? 1 : plans[i % plans.length] === 'starter' ? 10 : 100
            },
            features: {
              sso: plans[i % plans.length] === 'enterprise',
              apiAccess: ['starter', 'pro', 'enterprise'].includes(plans[i % plans.length]),
              advancedAnalytics: ['pro', 'enterprise'].includes(plans[i % plans.length]),
              customWorkflows: plans[i % plans.length] === 'enterprise',
              whiteLabel: plans[i % plans.length] === 'enterprise'
            },
            billing: {
              method: 'credit_card',
              address: {
                line1: faker.address.streetAddress(),
                city: faker.address.city(),
                state: faker.address.state(),
                country: faker.address.countryCode(),
                postalCode: faker.address.zipCode()
              },
              taxId: faker.datatype.string({ length: 10 }).toUpperCase()
            }
          }
        }
      })

      this.createdOrganizations.push(organization)
      console.log(`  Created organization: ${organization.name} (${organization.slug})`)
    }
  }

  private async createUsers(): Promise<void> {
    console.log('\n👥 Creating users...')

    const roles = ['owner', 'admin', 'manager', 'member']

    for (const org of this.createdOrganizations) {
      const orgUsers: any[] = []

      // Create owner for each organization
      const ownerPassword = await bcrypt.hash('owner123', 10)
      const owner = await prisma.user.create({
        data: {
          username: faker.internet.userName(),
          email: faker.internet.email(),
          fullName: faker.name.fullName(),
          password: ownerPassword,
          avatar: faker.image.avatar(),
          isActive: true,
          lastLoginAt: faker.date.recent()
        }
      })

      orgUsers.push(owner)
      this.createdUsers.push(owner)

      // Add owner to organization
      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: owner.id,
          role: 'owner',
          permissions: this.getPermissionsForRole('owner'),
          status: 'active',
          joinedAt: new Date()
        }
      })

      // Create additional users for the organization
      for (let i = 1; i < this.config.usersPerOrg; i++) {
        const userPassword = await bcrypt.hash('user123', 10)
        const user = await prisma.user.create({
          data: {
            username: faker.internet.userName(),
            email: faker.internet.email(),
            fullName: faker.name.fullName(),
            password: userPassword,
            avatar: faker.image.avatar(),
            isActive: true,
            lastLoginAt: faker.date.recent()
          }
        })

        orgUsers.push(user)
        this.createdUsers.push(user)

        // Assign to organization with varying roles
        const role = roles[i % roles.length]
        await prisma.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: role as any,
            permissions: this.getPermissionsForRole(role as any),
            status: 'active',
            joinedAt: faker.date.past()
          }
        })
      }

      console.log(`  Created ${orgUsers.length} users for ${org.name}`)
    }
  }

  private async createTeams(): Promise<void> {
    console.log('\n👨‍👩‍👧‍👦 Creating teams...')

    const teamNames = [
      'Data Annotation',
      'Quality Assurance',
      'Machine Learning',
      'Research & Development',
      'Customer Support',
      'Operations',
      'Engineering',
      'Product'
    ]

    for (const org of this.createdOrganizations) {
      // Get organization members
      const members = await prisma.organizationMember.findMany({
        where: { organizationId: org.id },
        include: { user: true }
      })

      for (let i = 0; i < this.config.teamsPerOrg; i++) {
        const teamName = teamNames[i % teamNames.length] || `Team ${i + 1}`

        const team = await prisma.team.create({
          data: {
            organizationId: org.id,
            name: teamName,
            description: faker.lorem.sentences(2),
            avatar: faker.image.imageUrl(100, 100, 'abstract'),
            settings: {
              isPublic: faker.datatype.boolean(),
              allowJoinRequests: faker.datatype.boolean(),
              requireApproval: true,
              defaultRole: 'member',
              permissions: {
                canCreateProjects: true,
                canInviteMembers: faker.datatype.boolean(),
                canManageSettings: false,
                canViewAnalytics: faker.datatype.boolean()
              },
              notifications: {
                newMember: true,
                projectUpdates: true,
                mentions: true
              }
            }
          }
        })

        // Add random members to team
        const teamLead = members[i % members.length]
        await prisma.teamMember.create({
          data: {
            teamId: team.id,
            userId: teamLead.userId,
            role: 'owner',
            permissions: this.getTeamPermissionsForRole('owner'),
            invitedBy: teamLead.userId,
            status: 'active',
            joinedAt: new Date()
          }
        })

        // Add 2-5 additional members
        const numMembers = faker.datatype.number({ min: 2, max: 5 })
        for (let j = 0; j < Math.min(numMembers, members.length - 1); j++) {
          const member = members[(i + j + 1) % members.length]
          const roles = ['admin', 'manager', 'lead', 'member']
          const role = roles[faker.datatype.number({ min: 0, max: roles.length - 1 })]

          await prisma.teamMember.create({
            data: {
              teamId: team.id,
              userId: member.userId,
              role: role as any,
              permissions: this.getTeamPermissionsForRole(role as any),
              invitedBy: teamLead.userId,
              status: 'active',
              joinedAt: faker.date.past()
            }
          })
        }

        console.log(`  Created team: ${team.name} in ${org.name}`)
      }
    }
  }

  private async createProjects(): Promise<void> {
    console.log('\n📂 Creating projects...')

    const projectTypes = ['image_classification', 'text_annotation', 'audio_transcription', 'data_validation']
    const statuses = ['planning', 'active', 'review', 'completed']

    for (const org of this.createdOrganizations) {
      const teams = await prisma.team.findMany({
        where: { organizationId: org.id },
        include: { members: true }
      })

      for (const team of teams) {
        for (let i = 0; i < this.config.projectsPerTeam; i++) {
          const project = await prisma.project.create({
            data: {
              teamId: team.id,
              name: faker.lorem.words(3),
              description: faker.lorem.paragraph(),
              type: projectTypes[i % projectTypes.length] as any,
              status: statuses[faker.datatype.number({ min: 0, max: statuses.length - 1 })] as any,
              settings: {
                deadline: faker.date.future(),
                budget: faker.datatype.number({ min: 1000, max: 50000 }),
                priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
                tags: faker.helpers.arrayElements(['urgent', 'client', 'internal', 'research', 'production'], 2)
              },
              metadata: {
                totalTasks: faker.datatype.number({ min: 100, max: 10000 }),
                completedTasks: faker.datatype.number({ min: 0, max: 8000 }),
                accuracy: faker.datatype.number({ min: 85, max: 99, precision: 0.01 })
              }
            }
          })

          // Assign some team members to the project
          const membersToAdd = faker.datatype.number({ min: 1, max: Math.min(3, team.members.length) })
          const shuffledMembers = faker.helpers.shuffle(team.members)

          for (let j = 0; j < membersToAdd; j++) {
            await prisma.projectMember.create({
              data: {
                projectId: project.id,
                userId: shuffledMembers[j].userId,
                role: j === 0 ? 'lead' : 'member',
                joinedAt: faker.date.past()
              }
            })
          }
        }
      }
    }
  }

  private async createAuditLogs(): Promise<void> {
    console.log('\n📊 Creating audit logs...')

    const actions = [
      'organization.created',
      'organization.updated',
      'team.created',
      'team.member_added',
      'project.created',
      'project.updated',
      'user.login'
    ]

    for (const org of this.createdOrganizations) {
      const members = await prisma.organizationMember.findMany({
        where: { organizationId: org.id },
        include: { user: true }
      })

      for (let i = 0; i < 20; i++) {
        const member = faker.helpers.arrayElement(members)
        const action = faker.helpers.arrayElement(actions)
        const resourceType = action.split('.')[0]

        await prisma.auditLog.create({
          data: {
            organizationId: org.id,
            userId: member.userId,
            action,
            resourceType,
            resourceId: faker.datatype.uuid(),
            details: {
              userAgent: faker.internet.userAgent(),
              ipAddress: faker.internet.ip(),
              description: faker.lorem.sentence()
            },
            timestamp: faker.date.recent()
          }
        })
      }
    }
  }

  private getPermissionsForRole(role: string): string[] {
    const permissions = {
      owner: [
        'organization:read',
        'organization:write',
        'organization:delete',
        'organization:manage_members',
        'organization:billing',
        'team:create',
        'team:manage',
        'project:create',
        'project:manage'
      ],
      admin: [
        'organization:read',
        'organization:write',
        'organization:manage_members',
        'team:create',
        'team:manage',
        'project:create',
        'project:manage'
      ],
      manager: [
        'organization:read',
        'team:create',
        'team:manage',
        'project:create',
        'project:manage'
      ],
      member: [
        'organization:read',
        'team:read',
        'project:read',
        'project:write'
      ]
    }

    return permissions[role] || permissions.member
  }

  private getTeamPermissionsForRole(role: string): string[] {
    const permissions = {
      owner: [
        'team:read',
        'team:write',
        'team:delete',
        'team:manage_members',
        'project:create',
        'project:manage',
        'analytics:view'
      ],
      admin: [
        'team:read',
        'team:write',
        'team:manage_members',
        'project:create',
        'project:manage',
        'analytics:view'
      ],
      manager: [
        'team:read',
        'team:write',
        'project:create',
        'project:manage',
        'analytics:view'
      ],
      lead: [
        'team:read',
        'project:create',
        'project:manage'
      ],
      member: [
        'team:read',
        'project:read',
        'project:write'
      ]
    }

    return permissions[role] || permissions.member
  }

  private printSummary(): void {
    console.log('\n📈 Seeding Summary:')
    console.log(`  Organizations: ${this.createdOrganizations.length}`)
    console.log(`  Users: ${this.createdUsers.length}`)
    console.log(`  Teams: ${this.config.organizations * this.config.teamsPerOrg}`)
    console.log(`  Projects: ${this.config.organizations * this.config.teamsPerOrg * this.config.projectsPerTeam}`)
    console.log('\n🔑 Test Credentials:')

    for (const org of this.createdOrganizations.slice(0, 2)) {
      const owner = await prisma.organizationMember.findFirst({
        where: {
          organizationId: org.id,
          role: 'owner'
        },
        include: { user: true }
      })

      if (owner) {
        console.log(`\n${org.name}:`)
        console.log(`  Email: ${owner.user.email}`)
        console.log(`  Password: owner123`)
        console.log(`  Organization ID: ${org.id}`)
      }
    }
  }
}

// Run seeder if executed directly
if (require.main === module) {
  const config = {
    organizations: parseInt(process.argv[2]) || DEFAULT_CONFIG.organizations,
    teamsPerOrg: parseInt(process.argv[3]) || DEFAULT_CONFIG.teamsPerOrg,
    usersPerOrg: parseInt(process.argv[4]) || DEFAULT_CONFIG.usersPerOrg,
    projectsPerTeam: parseInt(process.argv[5]) || DEFAULT_CONFIG.projectsPerTeam
  }

  const seeder = new MultiTenantSeeder(config)
  seeder.seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export { MultiTenantSeeder }