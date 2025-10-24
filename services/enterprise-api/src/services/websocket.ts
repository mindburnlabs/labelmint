import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'

export function setupWebSocket(httpServer: any): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  })

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`)
    })

    socket.on('join-room', (roomId: string) => {
      socket.join(roomId)
    })

    socket.on('leave-room', (roomId: string) => {
      socket.leave(roomId)
    })
  })

  return io
}