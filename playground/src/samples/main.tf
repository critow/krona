terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "env" {
  type    = string
  default = "staging"
}

# The edge instance and everything it needs.
resource "aws_instance" "web" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "t3.micro"

  user_data = <<-EOT
    #!/bin/bash
    echo "starting the edge" > /var/log/edge.log
    systemctl start edge
  EOT

  tags = {
    Name = "web-${var.env}"
    Role = "edge"
  }
}

output "address" {
  value       = aws_instance.web.public_ip
  description = "Where the edge answers"
}
