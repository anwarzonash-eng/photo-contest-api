const MailchimpTransactional = require('@mailchimp/mailchimp_transactional');
import {getSecrets} from '../secret-manager';


export async function sendEmail(template){
    const message = {
      from_email: template.from_email,
      from_name: template.from_name,
      to: [{
        email: template.to_email,
        name: template.to_name,
        type: 'to',
        },
      ],
      subject: template.subject,
      html: template.body
    };

    try {
      const secret_key = await getSecrets();
      const mailchimp = new MailchimpTransactional(secret_key.MailChimpTransactionalApiKey);
      const response = await mailchimp.messages.send({ message });
      return { message: 'Email Sent Successfully' };
    } catch (error) {
      return { status: 'Error', message: 'Failed to send email' };
    }
}