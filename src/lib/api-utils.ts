import { NextResponse } from 'next/server'
import { AppError } from './errors'

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(error: unknown, fallbackMessage = 'Internal server error') {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }

  console.error('Unhandled error:', error)
  return NextResponse.json(
    {
      success: false,
      error: fallbackMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    },
    { status: 500 }
  )
}

export function validationError(message: string) {
  return NextResponse.json(
    { success: false, error: message, code: 'VALIDATION_ERROR' },
    { status: 400 }
  )
}
