declare module "nodemailer" {
  interface Transporter {
    sendMail(message: {
      to: string;
      from: string;
      subject: string;
      text?: string;
      html?: string;
    }): Promise<unknown>;
  }

  const nodemailer: {
    createTransport(config: unknown): Transporter;
  };

  export default nodemailer;
}
