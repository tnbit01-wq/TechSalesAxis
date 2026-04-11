from xhtml2pdf import pisa
from jinja2 import Environment, FileSystemLoader
import io
import os
import logging

logger = logging.getLogger(__name__)

class PDFGenerator:
    @staticmethod
    def generate_resume_pdf(data: dict, template_name: str = "professional") -> bytes:
        """
        Generates a PDF from a resume template and data.
        Returns the PDF as bytes.
        """
        # 1. Setup Jinja2 environment
        template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "resumes")
        env = Environment(loader=FileSystemLoader(template_dir))
        env.lstrip_blocks = True
        env.trim_blocks = True
        
        try:
            template = env.get_template(f"{template_name}.html")
        except Exception as e:
            logger.warning(f"Template {template_name}.html not found, falling back to professional: {e}")
            try:
                template = env.get_template("professional.html")
            except Exception as fallback_e:
                logger.error(f"Failed to load professional template: {fallback_e}")
                raise
        
        # 2. Render HTML
        try:
            html_content = template.render(**data)
            logger.debug(f"HTML rendered successfully for resume PDF")
        except Exception as e:
            logger.error(f"Failed to render template: {e}")
            raise Exception(f"Template rendering failed: {str(e)}")
        
        # 3. Create PDF
        try:
            pdf_buffer = io.BytesIO()
            pisa_status = pisa.CreatePDF(io.StringIO(html_content), dest=pdf_buffer)
            
            if pisa_status.err:
                logger.error(f"PDF generation errors: {pisa_status.err}")
                raise Exception(f"PDF generation failed with {len(pisa_status.err)} errors")
            
            logger.info(f"PDF generated successfully ({len(pdf_buffer.getvalue())} bytes)")
            return pdf_buffer.getvalue()
        except Exception as e:
            logger.error(f"PDF creation failed: {e}")
            raise Exception(f"Failed to generate PDF: {str(e)}")
