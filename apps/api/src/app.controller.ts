import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): any {
    return this.appService.getHealth();
  }

  @Post('auth/login')
  login(@Body() body: { username: string; password: string }): any {
    return this.appService.login(body.username, body.password);
  }

  @Get('me')
  getMe(@Req() req: any): any {
    return this.appService.getMe(this.getToken(req));
  }

  @Get('users')
  listUsers(@Req() req: any): any {
    return this.appService.listUsers(this.getToken(req));
  }

  @Get('tasks/my')
  listMyTasks(@Req() req: any): any {
    return this.appService.listMyTasks(this.getToken(req));
  }

  @Get('tasks/assigned')
  listAssignedTasks(@Req() req: any): any {
    return this.appService.listAssignedTasks(this.getToken(req));
  }

  @Get('tasks/review-queue')
  listTaskReviewQueue(@Req() req: any): any {
    return this.appService.listTaskReviewQueue(this.getToken(req));
  }

  @Post('task-templates')
  createTaskTemplate(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      description: string;
      requiredDocuments: Array<{ title: string; description: string; type: string }>;
    },
  ): any {
    return this.appService.createTaskTemplate(this.getToken(req), body);
  }

  @Get('task-templates')
  listTaskTemplates(@Req() req: any): any {
    return this.appService.listTaskTemplates(this.getToken(req));
  }

  @Post('tasks')
  assignTask(
    @Req() req: any,
    @Body()
    body: { templateId: string; dueDate: string; driverId: string },
  ): any {
    return this.appService.assignTask(this.getToken(req), body);
  }

  @Post('tasks/:taskId/submit')
  submitTask(
    @Req() req: any,
    @Param('taskId') taskId: string,
    @Body() body: { submittedDocuments: Array<{ requirementId: string; fileName: string; notes?: string }>; submissionNotes?: string },
  ): any {
    return this.appService.submitTask(this.getToken(req), taskId, body);
  }

  @Patch('tasks/:taskId/review')
  reviewTask(
    @Req() req: any,
    @Param('taskId') taskId: string,
    @Body() body: { decision: 'approved' | 'resubmit_required'; feedback?: string },
  ): any {
    return this.appService.reviewTask(this.getToken(req), taskId, body);
  }

  @Get('training/my')
  listMyTraining(@Req() req: any): any {
    return this.appService.listMyTraining(this.getToken(req));
  }

  @Get('training/progress')
  listTrainingProgress(@Req() req: any): any {
    return this.appService.listTrainingProgress(this.getToken(req));
  }

  @Post('training/:assignmentId/confirm')
  confirmTraining(@Req() req: any, @Param('assignmentId') assignmentId: string): any {
    return this.appService.confirmTraining(this.getToken(req), assignmentId);
  }

  @Post('documents')
  uploadDocument(
    @Req() req: any,
    @Body() body: { type: string; fileName: string; notes?: string },
  ): any {
    return this.appService.uploadDocument(this.getToken(req), body);
  }

  @Get('documents')
  listDocuments(@Req() req: any): any {
    return this.appService.listDocuments(this.getToken(req));
  }

  @Patch('documents/:documentId/review')
  reviewDocument(
    @Req() req: any,
    @Param('documentId') documentId: string,
    @Body() body: { decision: 'approved' | 'rejected' | 'needs_resubmission'; comment?: string },
  ): any {
    return this.appService.reviewDocument(this.getToken(req), documentId, body);
  }

  @Post('photos')
  uploadPhoto(
    @Req() req: any,
    @Body() body: { category: string; fileName: string; notes?: string },
  ): any {
    return this.appService.uploadPhoto(this.getToken(req), body);
  }

  @Get('photos')
  listPhotos(@Req() req: any): any {
    return this.appService.listPhotos(this.getToken(req));
  }

  @Post('dispo-forms')
  createDispoForm(@Req() req: any, @Body() body: { title: string; details: string }): any {
    return this.appService.createDispoForm(this.getToken(req), body);
  }

  @Get('dispo-forms')
  listDispoForms(@Req() req: any): any {
    return this.appService.listDispoForms(this.getToken(req));
  }

  @Patch('dispo-forms/:formId/sign-dispatcher')
  signDispoForm(@Req() req: any, @Param('formId') formId: string): any {
    return this.appService.signDispoForm(this.getToken(req), formId);
  }

  @Patch('dispo-forms/:formId/review')
  reviewDispoForm(
    @Req() req: any,
    @Param('formId') formId: string,
    @Body() body: { decision: 'approved' | 'rejected'; comment?: string },
  ): any {
    return this.appService.reviewDispoForm(this.getToken(req), formId, body);
  }

  private getToken(req: any): string {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }

    return auth.slice('Bearer '.length).trim();
  }
}
