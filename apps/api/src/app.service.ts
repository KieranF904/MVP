import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type Role = 'admin' | 'dispatcher' | 'driver';
type TaskStatus = 'assigned' | 'submitted' | 'approved' | 'resubmit_required';
type ReviewDecision = 'approved' | 'rejected' | 'needs_resubmission';
type DispoFormStatus =
  | 'draft'
  | 'dispatcher_signed'
  | 'submitted'
  | 'approved'
  | 'rejected';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: Role;
}

interface RequiredDocument {
  id: string;
  title: string;
  description: string;
  type: string;
}

interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  requiredDocuments: RequiredDocument[];
  createdBy: string;
  createdAt: string;
}

interface SubmittedDocument {
  requirementId: string;
  fileName: string;
  notes?: string;
}

interface Task {
  id: string;
  templateId: string;
  dueDate: string;
  driverId: string;
  assignedBy: string;
  status: TaskStatus;
  submittedAt?: string;
  reviewFeedback?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  submittedDocuments: SubmittedDocument[];
  submissionNotes?: string;
}

interface TrainingModule {
  id: string;
  title: string;
  content: string;
}

interface TrainingAssignment {
  id: string;
  moduleId: string;
  driverId: string;
  assignedBy: string;
  confirmedAt?: string;
}

interface DriverDocument {
  id: string;
  driverId: string;
  type: string;
  fileName: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewComment?: string;
  uploadedAt: string;
}

interface VehiclePhoto {
  id: string;
  driverId: string;
  category: string;
  fileName: string;
  notes?: string;
  uploadedAt: string;
}

interface DispoForm {
  id: string;
  driverId: string;
  dispatcherId?: string;
  title: string;
  details: string;
  status: DispoFormStatus;
  createdAt: string;
  dispatcherSignedAt?: string;
  adminReviewedBy?: string;
  adminReviewComment?: string;
}

@Injectable()
export class AppService {
  private readonly users: User[] = [
    {
      id: 'u_admin_1',
      username: 'admin',
      password: 'admin123',
      name: 'Main Admin',
      role: 'admin',
    },
    {
      id: 'u_dispatch_1',
      username: 'dispatcher',
      password: 'dispatcher123',
      name: 'Main Dispatcher',
      role: 'dispatcher',
    },
    {
      id: 'u_driver_1',
      username: 'driver1',
      password: 'driver123',
      name: 'Driver One',
      role: 'driver',
    },
  ];

  private readonly taskTemplates: TaskTemplate[] = [
    {
      id: 'tpl_1',
      title: 'Upload Tacho Data',
      description: 'Upload this week tacho export before Friday.',
      requiredDocuments: [
        {
          id: 'req_1',
          title: 'Tacho Export',
          description: 'Upload weekly tacho log export.',
          type: 'log',
        },
        {
          id: 'req_2',
          title: 'Vehicle Condition Photo',
          description: 'Upload clear photo of current vehicle condition.',
          type: 'photo',
        },
      ],
      createdBy: 'u_admin_1',
      createdAt: new Date().toISOString(),
    },
  ];

  private readonly tasks: Task[] = [
    {
      id: 't_1',
      templateId: 'tpl_1',
      dueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
      driverId: 'u_driver_1',
      assignedBy: 'u_admin_1',
      status: 'assigned',
      submittedDocuments: [],
    },
  ];

  private readonly trainingModules: TrainingModule[] = [
    {
      id: 'tm_1',
      title: 'Welcome Safety Training',
      content: 'Read all safety instructions and confirm completion.',
    },
  ];

  private readonly trainingAssignments: TrainingAssignment[] = [
    {
      id: 'ta_1',
      moduleId: 'tm_1',
      driverId: 'u_driver_1',
      assignedBy: 'u_admin_1',
    },
  ];

  private readonly documents: DriverDocument[] = [];
  private readonly photos: VehiclePhoto[] = [];
  private readonly dispoForms: DispoForm[] = [];

  login(username: string, password: string) {
    const user = this.users.find(
      (candidate) =>
        candidate.username.toLowerCase() === username.toLowerCase() &&
        candidate.password === password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: user.id,
      user: this.publicUser(user),
    };
  }

  getMe(token: string) {
    return this.publicUser(this.resolveUser(token));
  }

  createTaskTemplate(
    token: string,
    payload: {
      title: string;
      description: string;
      requiredDocuments: Array<{ title: string; description: string; type: string }>;
    },
  ) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin']);

    if (!payload.requiredDocuments?.length) {
      throw new ForbiddenException('At least one required document is needed');
    }

    const template: TaskTemplate = {
      id: this.makeId('tpl'),
      title: payload.title,
      description: payload.description,
      requiredDocuments: payload.requiredDocuments.map((item) => ({
        id: this.makeId('req'),
        title: item.title,
        description: item.description,
        type: item.type,
      })),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    this.taskTemplates.unshift(template);
    return template;
  }

  listTaskTemplates(token: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin', 'dispatcher']);
    return this.taskTemplates;
  }

  listMyTasks(token: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['driver']);

    return this.tasks
      .filter((task) => task.driverId === user.id)
      .map((task) => ({
        ...task,
        template: this.taskTemplates.find((template) => template.id === task.templateId),
      }));
  }

  listTaskReviewQueue(token: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin']);

    return this.tasks
      .filter((task) => task.status === 'submitted')
      .map((task) => ({
        ...task,
        template: this.taskTemplates.find((template) => template.id === task.templateId),
        driver: this.users.find((candidate) => candidate.id === task.driverId),
      }));
  }

  listAssignedTasks(token: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin', 'dispatcher']);

    return this.tasks.map((task) => ({
      ...task,
      template: this.taskTemplates.find((template) => template.id === task.templateId),
      driver: this.users.find((candidate) => candidate.id === task.driverId),
    }));
  }

  assignTask(
    token: string,
    payload: { templateId: string; dueDate: string; driverId: string },
  ) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin', 'dispatcher']);

    const driver = this.users.find(
      (candidate) => candidate.id === payload.driverId && candidate.role === 'driver',
    );

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const template = this.taskTemplates.find((candidate) => candidate.id === payload.templateId);
    if (!template) {
      throw new NotFoundException('Task template not found');
    }

    const task: Task = {
      id: this.makeId('t'),
      templateId: payload.templateId,
      dueDate: payload.dueDate,
      driverId: payload.driverId,
      assignedBy: user.id,
      status: 'assigned',
      submittedDocuments: [],
    };

    this.tasks.unshift(task);
    return task;
  }

  submitTask(
    token: string,
    taskId: string,
    payload: { submittedDocuments: SubmittedDocument[]; submissionNotes?: string },
  ) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['driver']);

    const task = this.tasks.find((candidate) => candidate.id === taskId && candidate.driverId === user.id);
    if (!task) {
      throw new NotFoundException('Task not found for this driver');
    }

    if (!['assigned', 'resubmit_required'].includes(task.status)) {
      throw new ForbiddenException('Task cannot be submitted in current status');
    }

    task.submittedDocuments = payload.submittedDocuments ?? [];
    task.submissionNotes = payload.submissionNotes;
    task.submittedAt = new Date().toISOString();
    task.status = 'submitted';
    task.reviewFeedback = undefined;

    return {
      ...task,
      template: this.taskTemplates.find((template) => template.id === task.templateId),
    };
  }

  reviewTask(
    token: string,
    taskId: string,
    payload: { decision: 'approved' | 'resubmit_required'; feedback?: string },
  ) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin']);

    const task = this.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    task.status = payload.decision;
    task.reviewFeedback = payload.feedback;
    task.reviewedAt = new Date().toISOString();
    task.reviewedBy = user.id;

    return {
      ...task,
      template: this.taskTemplates.find((template) => template.id === task.templateId),
    };
  }

  listMyTraining(token: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['driver']);

    return this.trainingAssignments
      .filter((assignment) => assignment.driverId === user.id)
      .map((assignment) => ({
        ...assignment,
        module: this.trainingModules.find((module) => module.id === assignment.moduleId),
      }));
  }

  confirmTraining(token: string, assignmentId: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['driver']);

    const assignment = this.trainingAssignments.find(
      (candidate) => candidate.id === assignmentId && candidate.driverId === user.id,
    );

    if (!assignment) {
      throw new NotFoundException('Training assignment not found');
    }

    assignment.confirmedAt = new Date().toISOString();
    return assignment;
  }

  listTrainingProgress(token: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin', 'dispatcher']);

    return this.trainingAssignments.map((assignment) => {
      const driver = this.users.find((candidate) => candidate.id === assignment.driverId);
      const module = this.trainingModules.find((candidate) => candidate.id === assignment.moduleId);
      return {
        ...assignment,
        driver: driver ? this.publicUser(driver) : undefined,
        module,
      };
    });
  }

  uploadDocument(
    token: string,
    payload: { type: string; fileName: string; notes?: string },
  ) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['driver']);

    const document: DriverDocument = {
      id: this.makeId('doc'),
      driverId: user.id,
      type: payload.type,
      fileName: payload.fileName,
      notes: payload.notes,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
    };

    this.documents.unshift(document);
    return document;
  }

  listDocuments(token: string) {
    const user = this.resolveUser(token);

    if (user.role === 'driver') {
      return this.documents.filter((document) => document.driverId === user.id);
    }

    return this.documents;
  }

  reviewDocument(
    token: string,
    documentId: string,
    payload: { decision: ReviewDecision; comment?: string },
  ) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin']);

    const document = this.documents.find((candidate) => candidate.id === documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.status = payload.decision === 'approved' ? 'approved' : 'rejected';
    document.reviewedBy = user.id;
    document.reviewComment = payload.comment;

    return document;
  }

  uploadPhoto(
    token: string,
    payload: { category: string; fileName: string; notes?: string },
  ) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['driver']);

    const photo: VehiclePhoto = {
      id: this.makeId('photo'),
      driverId: user.id,
      category: payload.category,
      fileName: payload.fileName,
      notes: payload.notes,
      uploadedAt: new Date().toISOString(),
    };

    this.photos.unshift(photo);
    return photo;
  }

  listPhotos(token: string) {
    const user = this.resolveUser(token);
    if (user.role === 'driver') {
      return this.photos.filter((photo) => photo.driverId === user.id);
    }

    return this.photos;
  }

  createDispoForm(token: string, payload: { title: string; details: string }) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['driver']);

    const form: DispoForm = {
      id: this.makeId('df'),
      driverId: user.id,
      title: payload.title,
      details: payload.details,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    this.dispoForms.unshift(form);
    return form;
  }

  signDispoForm(token: string, formId: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['dispatcher']);

    const form = this.dispoForms.find((candidate) => candidate.id === formId);
    if (!form) {
      throw new NotFoundException('Dispo form not found');
    }

    form.dispatcherId = user.id;
    form.dispatcherSignedAt = new Date().toISOString();
    form.status = 'submitted';

    return form;
  }

  reviewDispoForm(
    token: string,
    formId: string,
    payload: { decision: 'approved' | 'rejected'; comment?: string },
  ) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin']);

    const form = this.dispoForms.find((candidate) => candidate.id === formId);
    if (!form) {
      throw new NotFoundException('Dispo form not found');
    }

    form.status = payload.decision;
    form.adminReviewedBy = user.id;
    form.adminReviewComment = payload.comment;

    return form;
  }

  listDispoForms(token: string) {
    const user = this.resolveUser(token);
    if (user.role === 'driver') {
      return this.dispoForms.filter((form) => form.driverId === user.id);
    }

    return this.dispoForms;
  }

  listUsers(token: string) {
    const user = this.resolveUser(token);
    this.requireRole(user, ['admin', 'dispatcher']);
    return this.users.map((candidate) => this.publicUser(candidate));
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'driver-hub-api',
      now: new Date().toISOString(),
    };
  }

  private resolveUser(token?: string): User {
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const user = this.users.find((candidate) => candidate.id === token);
    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    return user;
  }

  private requireRole(user: User, allowedRoles: Role[]) {
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role permissions');
    }
  }

  private publicUser(user: User) {
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }

  private makeId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
