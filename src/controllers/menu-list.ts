import { Router, Request, Response } from 'express';
import { laruinaMenu } from '../misc/laruinarecords/list';
import { nhexaMenu } from '../misc/nhexa/list';
import { terminalcoreMenu } from '../misc/terminalcorelabs/list';

const router = Router();

router.get('/:app', (req: Request, res: Response) => {
  const { app } = req.params;

  if (app === 'nhexa') return res.status(200).send(nhexaMenu);
  if (app === 'laruina') return res.status(200).send(laruinaMenu);
  if (app === 'terminalcore') return res.status(200).send(terminalcoreMenu);

  return res.status(404).send('Not found');
});

export default router;
