import argon2 from "argon2";
export async function verifyPassword(hash: string, password: string) { return await argon2.verify(hash, password); }
export async function hashPassword(password: string) { return await argon2.hash(password); }