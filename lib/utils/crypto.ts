import { hash, compare } from "bcryptjs"
import { SignJWT, jwtVerify, JWTPayload } from "jose"
import { v4 as uuidv4 } from "uuid"

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return compare(password, hashed)
}

export function randomId(): string {
  return uuidv4()
}

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || ""
  return new TextEncoder().encode(secret)
}

export async function signJWT(payload: JWTPayload, expiresIn = "1h"): Promise<string> {
  return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(getJWTSecret())
}

export async function verifyJWT<T extends JWTPayload = JWTPayload>(token: string): Promise<T> {
  const { payload } = await jwtVerify(token, getJWTSecret())
  return payload as T
}

async function getCryptoKey() {
  const key = process.env.ENCRYPTION_KEY || ""
  const raw = new TextEncoder().encode(key)
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]) as Promise<CryptoKey>
}

export async function encrypt(plain: Uint8Array): Promise<string> {
  const key = await getCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)
  const out = new Uint8Array(iv.byteLength + cipher.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(cipher), iv.byteLength)
  return Buffer.from(out).toString("base64")
}

export async function decrypt(encoded: string): Promise<Uint8Array> {
  const data = Buffer.from(encoded, "base64")
  const iv = data.subarray(0, 12)
  const body = data.subarray(12)
  const key = await getCryptoKey()
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body)
  return new Uint8Array(plain)
}