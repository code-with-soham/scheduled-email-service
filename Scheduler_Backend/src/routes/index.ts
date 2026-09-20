import { Router } from 'express';
import { createEmail, listEmails, listSenders, searchEmails } from '../controllers/emails';
import { connectSlack, disconnectSlack, slackCallback, slackStatus } from '../controllers/slack';

export const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.get('/senders', listSenders);
router.post('/emails', createEmail);
router.get('/emails', listEmails);
router.get('/emails/search', searchEmails);
router.get('/slack/connect', connectSlack);
router.get('/slack/oauth/callback', slackCallback);
router.post('/slack/disconnect', disconnectSlack);
router.get('/slack/status', slackStatus);
