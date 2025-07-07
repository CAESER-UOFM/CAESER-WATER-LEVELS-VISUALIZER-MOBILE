import { Handler, HandlerEvent } from '@netlify/functions';
import { TursoService } from '../../src/lib/api/services/turso';
import { cacheService, CacheService } from '../../src/lib/api/services/cache';
import { ApiResponse, WaterLevelReading, RechargeResult, DataQueryParams } from '../../src/lib/api/api';

const tursoService = new TursoService();

export const handler: Handler = async (event: HandlerEvent) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Parse the path to determine action
  const path = event.path.replace('/.netlify/functions/data', '');
  const pathParts = path.split('/').filter(p => p);

  try {
    // GET /data/:databaseId/water/:wellNumber - Get water level data
    if (event.httpMethod === 'GET' && pathParts.length === 3 && pathParts[1] === 'water') {
      const [databaseId, , wellNumber] = pathParts;
      return await getWaterLevelData(databaseId, wellNumber, event.queryStringParameters || {});
    }

    // GET /data/:databaseId/recharge/:wellNumber - Get recharge results
    if (event.httpMethod === 'GET' && pathParts.length === 3 && pathParts[1] === 'recharge') {
      const [databaseId, , wellNumber] = pathParts;
      return await getRechargeResults(databaseId, wellNumber);
    }

    // GET /data/:databaseId/summary/:wellNumber - Get data summary
    if (event.httpMethod === 'GET' && pathParts.length === 3 && pathParts[1] === 'summary') {
      const [databaseId, , wellNumber] = pathParts;
      return await getDataSummary(databaseId, wellNumber);
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Not found'
      } as ApiResponse),
    };

  } catch (error) {
    console.error('Data function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      } as ApiResponse),
    };
  }
};

async function getWaterLevelData(databaseId: string, wellNumber: string, queryParams: Record<string, string | undefined>) {
  // Validate and sanitize parameters
  const params: DataQueryParams = {
    wellNumber
  };

  // StartDate parameter
  if (queryParams.startDate && typeof queryParams.startDate === 'string') {
    const startDate = new Date(queryParams.startDate);
    if (!isNaN(startDate.getTime())) {
      params.startDate = queryParams.startDate;
    }
  }

  // EndDate parameter
  if (queryParams.endDate && typeof queryParams.endDate === 'string') {
    const endDate = new Date(queryParams.endDate);
    if (!isNaN(endDate.getTime())) {
      params.endDate = queryParams.endDate;
    }
  }

  // DataType parameter
  if (queryParams.dataType && typeof queryParams.dataType === 'string') {
    const allowedTypes = ['all', 'transducer', 'telemetry', 'manual'];
    if (allowedTypes.includes(queryParams.dataType)) {
      params.dataType = queryParams.dataType as any;
    }
  }

  // Downsample parameter
  if (queryParams.downsample !== undefined) {
    params.downsample = queryParams.downsample === 'true';
  }

  // Adaptive sampling rate parameter (replaces level-based approach)
  if (queryParams.samplingRate && typeof queryParams.samplingRate === 'string') {
    const allowedRates = ['15min', '30min', '1hour', '3hour', '6hour', '12hour', '1day', 'daily', '3day', '1week', '1month'] as const;
    if (allowedRates.includes(queryParams.samplingRate as any)) {
      params.samplingRate = queryParams.samplingRate as typeof allowedRates[number];
      params.downsample = true;
    }
  }

  // Legacy progressive loading level parameter (fallback)
  if (queryParams.level && !queryParams.samplingRate) {
    const level = parseInt(queryParams.level);
    if (level >= 1 && level <= 3) {
      params.level = level as 1 | 2 | 3;
      // Use adaptive sampling instead of fixed points
      params.maxPoints = 4500;
      params.downsample = true;
    }
  }

  // Legacy MaxPoints parameter (fallback)
  if (queryParams.maxPoints && !queryParams.level) {
    const maxPoints = parseInt(queryParams.maxPoints);
    if (!isNaN(maxPoints) && maxPoints >= 1) {
      params.maxPoints = Math.min(maxPoints, 10000);
    }
  }

  // Generate cache key based on parameters
  const cacheKey = CacheService.generateParamsKey(params);
  
  // Check cache first
  const cachedData = cacheService.getWaterLevelData(databaseId, cacheKey);
  if (cachedData) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: cachedData
      } as ApiResponse<WaterLevelReading[]>),
    };
  }

  // Get water level data directly from Turso
  const waterLevelData = await tursoService.getWaterLevelData(params);

  // Cache the result (shorter TTL for data queries)
  cacheService.setWaterLevelData(databaseId, cacheKey, waterLevelData);

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      data: waterLevelData,
      metadata: {
        wellNumber: params.wellNumber,
        dataType: params.dataType || 'all',
        totalPoints: waterLevelData.length,
        downsample: params.downsample || false,
        dateRange: {
          start: params.startDate,
          end: params.endDate
        }
      }
    } as ApiResponse<WaterLevelReading[]>),
  };
}

async function getRechargeResults(databaseId: string, wellNumber: string) {
  // Check cache first
  const cachedResults = cacheService.getRechargeResults(databaseId, wellNumber);
  if (cachedResults) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: cachedResults
      } as ApiResponse<RechargeResult[]>),
    };
  }

  // Get recharge results directly from Turso
  const rechargeResults = await tursoService.getRechargeResults(wellNumber);

  // Cache the result
  cacheService.setRechargeResults(databaseId, wellNumber, rechargeResults);

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      data: rechargeResults,
      metadata: {
        wellNumber,
        totalCalculations: rechargeResults.length,
        methods: [...new Set(rechargeResults.map(r => r.method))]
      }
    } as ApiResponse<RechargeResult[]>),
  };
}

async function getDataSummary(databaseId: string, wellNumber: string) {
  // Check cache first
  const cacheKey = `summary:${wellNumber}`;
  const cachedSummary = cacheService.get(cacheKey);
  if (cachedSummary) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: cachedSummary
      } as ApiResponse),
    };
  }

  // Get well info directly from Turso
  const well = await tursoService.getWell(wellNumber);
  if (!well) {
    return {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Well not found'
      } as ApiResponse),
    };
  }

  // Get data counts by type
  const allData = await tursoService.getWaterLevelData({ wellNumber });
  const rechargeResults = await tursoService.getRechargeResults(wellNumber);

  const dataTypeCounts = allData.reduce((counts, reading) => {
    counts[reading.data_source] = (counts[reading.data_source] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const summary = {
    well,
    totalReadings: allData.length,
    dataTypeCounts,
    dateRange: allData.length > 0 ? {
      start: allData[0].timestamp_utc,
      end: allData[allData.length - 1].timestamp_utc
    } : null,
    rechargeCalculations: rechargeResults.length,
    rechargeMethodCounts: rechargeResults.reduce((counts, result) => {
      counts[result.method] = (counts[result.method] || 0) + 1;
      return counts;
    }, {} as Record<string, number>)
  };

  // Cache the result
  cacheService.set(cacheKey, summary, 30 * 60); // 30 minutes TTL

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      data: summary
    } as ApiResponse),
  };
}