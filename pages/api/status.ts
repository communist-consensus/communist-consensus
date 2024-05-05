import type { NextApiRequest, NextApiResponse } from 'next'

type User ={}
export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<User[]>
) {
  // Get data from your database
  res.status(200).json([{
    asdf: 123
  }])
}