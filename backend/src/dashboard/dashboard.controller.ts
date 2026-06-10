import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Query('period') period: 'day' | 'month' = 'day') {
    return this.dashboardService.getSummary(period);
  }

  @Get('export')
  async exportExcel(
    @Query('start') startDate: string,
    @Query('end') endDate: string,
    @Res() res: Response,
  ) {
    const buffer = await this.dashboardService.exportToExcel(startDate, endDate);
    const filename = `sales_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
