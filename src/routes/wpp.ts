import { Router } from 'express';
import whatsappRoutes from './whatsapp.routes';


const routerWpp = Router();

routerWpp.use('/whatsapp', whatsappRoutes);

export default routerWpp;
