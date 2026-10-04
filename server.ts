import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiverModule = require('archiver');
const archiver = typeof archiverModule === 'function'
  ? archiverModule
  : typeof archiverModule?.default === 'function'
    ? archiverModule.default
    : typeof archiverModule?.create === 'function'
      ? archiverModule.create
      : typeof archiverModule?.archiver === 'function'
        ? archiverModule.archiver
        : null;
import * as XLSX from 'xlsx';

dotenv.config();