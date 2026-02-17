"use client"

import React, { useState } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Camera,
  Phone,
  MessageSquare,
  MapPin,
  Plus,
  PlayCircle,
  PauseCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Demo data types
interface Task {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  estimatedTime: string
  location?: string
  assignedTo?: string
  notes?: string
}

interface CrewMember {
  id: string
  name: string
  role: string
  status: 'on_site' | 'off_site' | 'break'
  currentTask?: string
  checkInTime?: Date
}

interface Issue {
  id: string
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  location: string
  reportedBy: string
  status: 'open' | 'resolved' | 'in_progress'
  timestamp: Date
}

// Demo data for 708 Purple Salvia Cove
const DEMO_TASKS: Task[] = [
  {
    id: '1',
    title: 'Electrical Rough-In Inspection',
    status: 'in_progress',
    priority: 'high',
    estimatedTime: '4 hrs',
    location: 'Main Floor',
    assignedTo: 'Mike (Electrician)',
    notes: 'Inspector arriving at 10 AM. Ensure all junction boxes are accessible.',
  },
  {
    id: '2',
    title: 'Plumbing Pressure Test',
    status: 'pending',
    priority: 'medium',
    estimatedTime: '2 hrs',
    location: 'Kitchen & Bathrooms',
    assignedTo: 'Joe (Plumber)',
  },
  {
    id: '3',
    title: 'Frame Walk-Through with UBuildIt',
    status: 'pending',
    priority: 'urgent',
    estimatedTime: '1.5 hrs',
    location: 'Full House',
    notes: 'Randy from UBuildIt scheduled for afternoon walk-through.',
  },
  {
    id: '4',
    title: 'Insulation Delivery & Staging',
    status: 'completed',
    priority: 'low',
    estimatedTime: '3 hrs',
    location: 'Garage',
    assignedTo: 'Delivery Team',
  },
]

const DEMO_CREW: CrewMember[] = [
  {
    id: '1',
    name: 'Mike Rodriguez',
    role: 'Master Electrician',
    status: 'on_site',
    currentTask: 'Electrical Rough-In Inspection',
    checkInTime: new Date(new Date().setHours(7, 30)),
  },
  {
    id: '2',
    name: 'Joe Williams',
    role: 'Plumber',
    status: 'on_site',
    currentTask: 'Plumbing Pressure Test',
    checkInTime: new Date(new Date().setHours(8, 0)),
  },
  {
    id: '3',
    name: 'Carlos Mendez',
    role: 'HVAC Technician',
    status: 'off_site',
  },
  {
    id: '4',
    name: 'Tom Baker',
    role: 'General Laborer',
    status: 'break',
    currentTask: 'Site cleanup',
    checkInTime: new Date(new Date().setHours(6, 45)),
  },
]

const DEMO_ISSUES: Issue[] = [
  {
    id: '1',
    type: 'Safety',
    severity: 'high',
    description: 'Missing GFCI protection in master bathroom circuit',
    location: 'Master Bathroom',
    reportedBy: 'Mike Rodriguez',
    status: 'open',
    timestamp: new Date(new Date().setHours(9, 15)),
  },
  {
    id: '2',
    type: 'Material',
    severity: 'medium',
    description: 'Wrong size PEX fittings delivered - need 3/4" not 1/2"',
    location: 'Garage (staging)',
    reportedBy: 'Joe Williams',
    status: 'in_progress',
    timestamp: new Date(new Date().setHours(8, 45)),
  },
]

const JobSiteDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(DEMO_TASKS)
  const [activeTab, setActiveTab] = useState<'tasks' | 'crew' | 'issues' | 'photos'>('tasks')

  const crew = DEMO_CREW
  const issues = DEMO_ISSUES

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': case 'resolved': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      case 'pending': case 'open': return 'bg-yellow-500'
      case 'blocked': case 'critical': return 'bg-red-500'
      case 'on_site': return 'bg-green-500'
      case 'off_site': return 'bg-gray-500'
      case 'break': return 'bg-yellow-500'
      default: return 'bg-gray-400'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500'
      case 'high': return 'border-l-orange-500'
      case 'medium': return 'border-l-yellow-500'
      case 'low': return 'border-l-green-500'
      default: return 'border-l-gray-400'
    }
  }

  const TabButton: React.FC<{
    tab: string
    icon: React.ReactNode
    label: string
    isActive: boolean
    badge?: number
  }> = ({ tab, icon, label, isActive, badge }) => (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => setActiveTab(tab as typeof activeTab)}
      className={`
        flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-lg
        transition-all duration-200 min-h-[70px] relative
        ${isActive
          ? 'bg-blue-600 text-white shadow-lg'
          : 'bg-white text-gray-600 border border-gray-200'
        }
      `}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-xs font-semibold">{label}</span>
      {badge !== undefined && badge > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
          {badge > 99 ? '99+' : badge}
        </div>
      )}
    </motion.button>
  )

  const TaskCard: React.FC<{ task: Task }> = ({ task }) => {
    const handleTaskStatusToggle = () => {
      const newStatus = task.status === 'in_progress' ? 'pending' : 'in_progress'
      updateTask(task.id, { status: newStatus })
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          bg-white rounded-xl shadow-lg border-l-4 ${getPriorityColor(task.priority)}
          p-5 mb-3
        `}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 mr-3">
            <h3 className="text-base font-bold text-gray-900 mb-1">{task.title}</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {task.estimatedTime}
              </span>
              {task.location && (
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {task.location}
                </span>
              )}
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-white text-xs font-semibold whitespace-nowrap ${getStatusColor(task.status)}`}>
            {task.status.replace('_', ' ')}
          </div>
        </div>

        {task.assignedTo && (
          <div className="flex items-center mb-2">
            <Users className="w-4 h-4 mr-2 text-gray-500" />
            <span className="text-sm text-gray-700">{task.assignedTo}</span>
          </div>
        )}

        {task.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
            <p className="text-sm text-gray-700">{task.notes}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleTaskStatusToggle}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center min-h-[44px]"
          >
            {task.status === 'in_progress' ? (
              <>
                <PauseCircle className="w-5 h-5 mr-2" />
                Pause
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5 mr-2" />
                Start
              </>
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold flex items-center justify-center min-h-[44px]"
          >
            <Camera className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>
    )
  }

  const CrewCard: React.FC<{ member: CrewMember }> = ({ member }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl shadow-lg p-5 mb-3"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{member.name}</h3>
            <p className="text-sm text-gray-600">{member.role}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-white text-xs font-semibold ${getStatusColor(member.status)}`}>
          {member.status.replace('_', ' ')}
        </div>
      </div>

      {member.currentTask && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Current Task:</span> {member.currentTask}
          </p>
        </div>
      )}

      {member.checkInTime && (
        <div className="text-sm text-gray-600 mb-3">
          <span className="font-semibold">Checked in:</span> {member.checkInTime.toLocaleTimeString()}
        </div>
      )}

      <div className="flex space-x-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center min-h-[44px]"
        >
          <Phone className="w-5 h-5 mr-2" />
          Call
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center min-h-[44px]"
        >
          <MessageSquare className="w-5 h-5 mr-2" />
          Message
        </motion.button>
      </div>
    </motion.div>
  )

  const IssueCard: React.FC<{ issue: Issue }> = ({ issue }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-lg p-5 mb-3 border-l-4 border-l-red-500"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-3">
          <div className="flex items-center space-x-2 mb-1">
            <AlertTriangle className={`w-5 h-5 ${
              issue.severity === 'critical' ? 'text-red-600' :
              issue.severity === 'high' ? 'text-orange-500' :
              issue.severity === 'medium' ? 'text-yellow-500' : 'text-green-500'
            }`} />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {issue.type} &bull; {issue.severity}
            </span>
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{issue.description}</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              {issue.location}
            </span>
            <span>{issue.reportedBy}</span>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-white text-xs font-semibold whitespace-nowrap ${getStatusColor(issue.status)}`}>
          {issue.status.replace('_', ' ')}
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        <span className="font-semibold">Reported:</span> {issue.timestamp.toLocaleString()}
      </div>

      <div className="flex space-x-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center min-h-[44px]"
        >
          <AlertTriangle className="w-5 h-5 mr-2" />
          Escalate
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold flex items-center justify-center min-h-[44px]"
        >
          <Camera className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  )

  return (
    <div>
      {/* Project Header */}
      <div className="bg-blue-700 text-white p-5">
        <div className="mb-3">
          <h2 className="text-xl font-bold">708 Purple Salvia Cove</h2>
          <p className="text-blue-200 text-sm">Liberty Hill, TX 78642</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-600 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">{tasks.filter(t => t.status === 'completed').length}</div>
            <div className="text-xs text-blue-200">Completed</div>
          </div>
          <div className="bg-blue-600 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">{crew.filter(c => c.status === 'on_site').length}</div>
            <div className="text-xs text-blue-200">On Site</div>
          </div>
          <div className="bg-blue-600 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">{issues.filter(i => i.status === 'open').length}</div>
            <div className="text-xs text-blue-200">Open Issues</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <TabButton
            tab="tasks"
            icon={<CheckCircle className="w-5 h-5" />}
            label="Tasks"
            isActive={activeTab === 'tasks'}
            badge={tasks.filter(t => t.status !== 'completed').length}
          />
          <TabButton
            tab="crew"
            icon={<Users className="w-5 h-5" />}
            label="Crew"
            isActive={activeTab === 'crew'}
            badge={crew.filter(c => c.status === 'on_site').length}
          />
          <TabButton
            tab="issues"
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Issues"
            isActive={activeTab === 'issues'}
            badge={issues.filter(i => i.status === 'open').length}
          />
          <TabButton
            tab="photos"
            icon={<Camera className="w-5 h-5" />}
            label="Photos"
            isActive={activeTab === 'photos'}
          />
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </motion.div>
          )}

          {activeTab === 'crew' && (
            <motion.div
              key="crew"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {crew.map(member => (
                <CrewCard key={member.id} member={member} />
              ))}
            </motion.div>
          )}

          {activeTab === 'issues' && (
            <motion.div
              key="issues"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {issues.map(issue => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </motion.div>
          )}

          {activeTab === 'photos' && (
            <motion.div
              key="photos"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-12"
            >
              <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Photo Gallery</h3>
              <p className="text-gray-500 mb-6">Capture progress photos and documentation</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="bg-blue-600 text-white py-3 px-8 rounded-lg font-semibold inline-flex items-center min-h-[44px]"
              >
                <Camera className="w-5 h-5 mr-2" />
                Take Photo
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-36 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-[60]"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  )
}

export default JobSiteDashboard
