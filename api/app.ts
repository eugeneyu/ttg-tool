/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import crawlerRoutes from './routes/crawler.js'
import resultsRoutes from './routes/results.js'
import historyRoutes from './routes/history.js'

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/crawler', crawlerRoutes)
app.use('/api/results', resultsRoutes)
app.use('/api/history', historyRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
